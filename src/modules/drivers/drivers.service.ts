import { DriverStatus } from "@prisma/client";

import type { AuthUser } from "../../common/types/auth";
import { isAdminRole, isDriverRole } from "../../common/utils/authorization";
import { syncDriverLocationSpatialColumn } from "../../common/utils/postgis";
import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";
import { emitDeliveryEvent, emitDriverEvent, emitTenantEvent, emitTrackingEvent } from "../../common/utils/socket";

const activeDeliveryStatuses = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "NEAR_DESTINATION"] as const;

export class DriversService {
  private async attachLinkedUsers<T extends { userId?: string | null }>(
    tenantId: string,
    drivers: T[],
  ) {
    const userIds = [...new Set(drivers.map((driver) => driver.userId).filter((userId): userId is string => !!userId))];

    if (userIds.length === 0) {
      return drivers.map((driver) => ({
        ...driver,
        user: null,
      }));
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    const userById = new Map(users.map((user) => [user.id, user]));

    return drivers.map((driver) => ({
      ...driver,
      user: driver.userId ? (userById.get(driver.userId) ?? null) : null,
    }));
  }

  private serializeDriverWithLatestLocation<
    T extends {
      locations: Array<{ latitude: number; longitude: number; recordedAt: Date }>;
    },
  >(driver: T) {
    return {
      ...driver,
      latestLocation: driver.locations[0] ?? null,
    };
  }

  private async getActorDriverProfile(tenantId: string, actor: AuthUser) {
    const driver = await prisma.driver.findFirst({
      where: {
        tenantId,
        userId: actor.userId,
      },
      select: {
        id: true,
      },
    });

    if (!driver) {
      throw new ApiError(403, "Driver profile is not linked to the authenticated user");
    }

    return driver;
  }

  private async ensureDriverAccess(
    tenantId: string,
    driverId: string,
    actor?: AuthUser,
  ) {
    if (!actor || isAdminRole(actor.role)) {
      return;
    }

    if (!isDriverRole(actor.role)) {
      throw new ApiError(403, "You do not have access to this driver");
    }

    const actorDriver = await this.getActorDriverProfile(tenantId, actor);

    if (actorDriver.id !== driverId) {
      throw new ApiError(403, "You do not have access to this driver");
    }
  }

  async list(tenantId: string, actor?: AuthUser) {
    const where =
      actor && isDriverRole(actor.role)
        ? {
            tenantId,
            userId: actor.userId,
          }
        : { tenantId };

    const drivers = await prisma.driver.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    return this.attachLinkedUsers(
      tenantId,
      drivers.map((driver) => this.serializeDriverWithLatestLocation(driver)),
    );
  }

  async getById(tenantId: string, id: string, actor?: AuthUser) {
    await this.ensureDriverAccess(tenantId, id, actor);

    const driver = await prisma.driver.findFirst({
      where: { tenantId, id },
      include: {
        deliveries: {
          orderBy: { updatedAt: "desc" },
          take: 20,
        },
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!driver) {
      throw new ApiError(404, "Driver not found");
    }

    const [driverWithUser] = await this.attachLinkedUsers(tenantId, [
      this.serializeDriverWithLatestLocation(driver),
    ]);

    return driverWithUser;
  }

  async create(
    tenantId: string,
    input: {
      userId?: string;
      name: string;
      phone: string;
      status: string;
    },
  ) {
    return prisma.driver.create({
      data: {
        tenantId,
        userId: input.userId,
        name: input.name,
        phone: input.phone,
        status: input.status as DriverStatus,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      userId?: string | null;
      name?: string;
      phone?: string;
      status?: string;
    },
  ) {
    await this.getById(tenantId, id);

    return prisma.driver.update({
      where: { id },
      data: {
        userId: input.userId,
        name: input.name,
        phone: input.phone,
        status: input.status as DriverStatus | undefined,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);

    await prisma.driver.delete({
      where: { id },
    });

    return { success: true };
  }

  async recordLocation(
    tenantId: string,
    driverId: string,
    input: { latitude: number; longitude: number },
    actor?: AuthUser,
  ) {
    await this.ensureDriverAccess(tenantId, driverId, actor);
    await this.getById(tenantId, driverId, actor);

    const location = await prisma.driverLocation.create({
      data: {
        tenantId,
        driverId,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });
    await syncDriverLocationSpatialColumn(prisma, location.id);

    emitDriverEvent(driverId, "driver:location_updated", location);
    emitTenantEvent(tenantId, "driver:location_updated", location);

    const activeDeliveries = await prisma.delivery.findMany({
      where: {
        tenantId,
        driverId,
        status: {
          in: [...activeDeliveryStatuses],
        },
      },
      select: {
        id: true,
        trackingCode: true,
      },
    });

    for (const delivery of activeDeliveries) {
      emitDeliveryEvent(delivery.id, "driver:location_updated", location);
      emitTrackingEvent(delivery.trackingCode, "driver:location_updated", location);
    }

    return location;
  }

  async getLatestLocation(tenantId: string, driverId: string, actor?: AuthUser) {
    await this.ensureDriverAccess(tenantId, driverId, actor);
    await this.getById(tenantId, driverId, actor);

    return prisma.driverLocation.findFirst({
      where: {
        tenantId,
        driverId,
      },
      orderBy: {
        recordedAt: "desc",
      },
    });
  }
}

export const driversService = new DriversService();
