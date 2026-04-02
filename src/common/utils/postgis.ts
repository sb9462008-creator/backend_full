import { Prisma, PrismaClient } from "@prisma/client";

type SqlClient = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

type DeliverySpatialRow = {
  distanceToPickupMeters: number | null;
  distanceToDropoffMeters: number | null;
};

type DriverDistanceRow = {
  driverId: string;
  distanceMeters: number;
};

let postgisReady = false;

export async function initializePostgis(db: SqlClient) {
  try {
    await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS postgis`;
    await db.$executeRaw`
      ALTER TABLE "Delivery"
      ADD COLUMN IF NOT EXISTS "pickupGeom" geography(Point, 4326)
    `;
    await db.$executeRaw`
      ALTER TABLE "Delivery"
      ADD COLUMN IF NOT EXISTS "dropoffGeom" geography(Point, 4326)
    `;
    await db.$executeRaw`
      ALTER TABLE "DriverLocation"
      ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326)
    `;
    await db.$executeRaw`
      UPDATE "Delivery"
      SET
        "pickupGeom" = ST_SetSRID(ST_MakePoint("pickupLng", "pickupLat"), 4326)::geography,
        "dropoffGeom" = ST_SetSRID(ST_MakePoint("dropoffLng", "dropoffLat"), 4326)::geography
      WHERE "pickupGeom" IS NULL OR "dropoffGeom" IS NULL
    `;
    await db.$executeRaw`
      UPDATE "DriverLocation"
      SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
      WHERE "geom" IS NULL
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Delivery_pickupGeom_idx"
      ON "Delivery" USING GIST ("pickupGeom")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Delivery_dropoffGeom_idx"
      ON "Delivery" USING GIST ("dropoffGeom")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DriverLocation_geom_idx"
      ON "DriverLocation" USING GIST ("geom")
    `;

    postgisReady = true;
  } catch (error) {
    postgisReady = false;
    console.warn("PostGIS bootstrap failed; spatial queries will be disabled", error);
  }

  return postgisReady;
}

export function isPostgisReady() {
  return postgisReady;
}

export async function syncDeliverySpatialColumns(db: SqlClient, deliveryId: string) {
  if (!postgisReady) {
    return;
  }

  await db.$executeRaw`
    UPDATE "Delivery"
    SET
      "pickupGeom" = ST_SetSRID(ST_MakePoint("pickupLng", "pickupLat"), 4326)::geography,
      "dropoffGeom" = ST_SetSRID(ST_MakePoint("dropoffLng", "dropoffLat"), 4326)::geography
    WHERE "id" = CAST(${deliveryId} AS uuid)
  `;
}

export async function syncDriverLocationSpatialColumn(db: SqlClient, locationId: string) {
  if (!postgisReady) {
    return;
  }

  await db.$executeRaw`
    UPDATE "DriverLocation"
    SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
    WHERE "id" = CAST(${locationId} AS uuid)
  `;
}

export async function getDeliverySpatialMetrics(db: SqlClient, deliveryId: string) {
  if (!postgisReady) {
    return null;
  }

  const [row] = await db.$queryRaw<DeliverySpatialRow[]>(Prisma.sql`
    SELECT
      ROUND(ST_Distance(location."geom", delivery."pickupGeom"))::int AS "distanceToPickupMeters",
      ROUND(ST_Distance(location."geom", delivery."dropoffGeom"))::int AS "distanceToDropoffMeters"
    FROM "Delivery" AS delivery
    LEFT JOIN LATERAL (
      SELECT latest."geom"
      FROM "DriverLocation" AS latest
      WHERE latest."driverId" = delivery."driverId"
      ORDER BY latest."recordedAt" DESC
      LIMIT 1
    ) AS location ON true
    WHERE delivery."id" = CAST(${deliveryId} AS uuid)
  `);

  return row ?? null;
}

export async function getDriverDistancesFromPoint(
  db: SqlClient,
  input: {
    tenantId: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
  },
) {
  if (!postgisReady) {
    return [];
  }

  const radiusFilter =
    input.radiusMeters == null
      ? Prisma.empty
      : Prisma.sql`
          AND ST_DWithin(
            latest_locations."geom",
            ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
            ${input.radiusMeters}
          )
        `;

  return db.$queryRaw<DriverDistanceRow[]>(Prisma.sql`
    WITH latest_locations AS (
      SELECT DISTINCT ON (location."driverId")
        location."driverId",
        location."geom"
      FROM "DriverLocation" AS location
      WHERE location."tenantId" = CAST(${input.tenantId} AS uuid)
        AND location."geom" IS NOT NULL
      ORDER BY location."driverId", location."recordedAt" DESC
    )
    SELECT
      latest_locations."driverId",
      ROUND(
        ST_Distance(
          latest_locations."geom",
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
        )
      )::int AS "distanceMeters"
    FROM latest_locations
    INNER JOIN "Driver" AS driver
      ON driver."id" = latest_locations."driverId"
    WHERE driver."tenantId" = CAST(${input.tenantId} AS uuid)
      AND driver."status" IN (${Prisma.join(["AVAILABLE", "BUSY", "OFFLINE"])})
      ${radiusFilter}
    ORDER BY "distanceMeters" ASC
  `);
}
