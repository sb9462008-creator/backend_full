import { DeliveryStatus, DriverStatus } from "@prisma/client";

import type { AuthUser } from "../../common/types/auth";
import { isAdminRole, isCustomerRole, isDriverRole } from "../../common/utils/authorization";
import {
  getDeliverySpatialMetrics,
  getDriverDistancesFromPoint,
  isPostgisReady,
  syncDeliverySpatialColumns,
} from "../../common/utils/postgis";
import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";
import { canTransitionDeliveryStatus, getStatusTimestampField } from "../../common/utils/delivery-status";
import { emitDeliveryEvent, emitTenantEvent, emitTrackingEvent } from "../../common/utils/socket";
import type { DeliveryStatusValue } from "../../common/types/enums";
import { notificationsService } from "../notifications/notifications.service";

const activeStatuses: DeliveryStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "NEAR_DESTINATION",
];

const driverUpdatableStatuses = new Set<DeliveryStatusValue>([
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "NEAR_DESTINATION",
  "DELIVERED",
  "FAILED",
  "RETURNED",
]);

function generateTrackingCode() {
  return `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export class DeliveriesService {
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

  private async createEvent(input: {
    tenantId: string;
    deliveryId: string;
    eventType: string;
    status?: DeliveryStatus;
    message?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return prisma.trackingEvent.create({
      data: input,
    });
  }

  private async notify(input: {
    tenantId: string;
    deliveryId: string;
    type: string;
    title: string;
    body: string;
  }) {
    await notificationsService.createInAppNotification({
      tenantId: input.tenantId,
      deliveryId: input.deliveryId,
      type: input.type,
      title: input.title,
      body: input.body,
    });
  }

  private async syncDriverAvailability(driverId?: string | null) {
    if (!driverId) {
      return;
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { status: true },
    });

    if (!driver || driver.status === DriverStatus.OFFLINE) {
      return;
    }

    const activeAssignments = await prisma.delivery.count({
      where: {
        driverId,
        status: {
          in: activeStatuses,
        },
      },
    });

    const nextStatus = activeAssignments > 0 ? DriverStatus.BUSY : DriverStatus.AVAILABLE;

    if (driver.status === nextStatus) {
      return;
    }

    await prisma.driver.update({
      where: { id: driverId },
      data: { status: nextStatus },
    });
  }

  private async assertDeliveryAccess(
    delivery: {
      driver?: { userId?: string | null } | null;
      createdById?: string | null;
      order?: { customerId: string } | null;
    },
    actor?: AuthUser,
  ) {
    if (!actor || isAdminRole(actor.role)) {
      return;
    }

    if (isDriverRole(actor.role)) {
      if (delivery.driver?.userId !== actor.userId) {
        throw new ApiError(403, "You do not have access to this delivery");
      }
      return;
    }

    if (isCustomerRole(actor.role)) {
      const customerId = delivery.order?.customerId ?? delivery.createdById;

      if (customerId !== actor.userId) {
        throw new ApiError(403, "You do not have access to this delivery");
      }
      return;
    }

    throw new ApiError(403, "You do not have access to this delivery");
  }

  async list(tenantId: string, actor?: AuthUser) {
    const where =
      actor && isDriverRole(actor.role)
        ? {
            tenantId,
            driver: {
              is: {
                userId: actor.userId,
              },
            },
          }
        : { tenantId };

    return prisma.delivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        driver: true,
        proof: true,
      },
    });
  }

  async getById(tenantId: string, id: string, actor?: AuthUser) {
    const delivery = await prisma.delivery.findFirst({
      where: { tenantId, id },
      include: {
        driver: {
          include: {
            locations: {
              orderBy: { recordedAt: "desc" },
              take: 1,
            },
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
        proof: true,
        order: {
          select: {
            customerId: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new ApiError(404, "Delivery not found");
    }

    await this.assertDeliveryAccess(delivery, actor);

    return {
      ...delivery,
      driver: delivery.driver ? this.serializeDriverWithLatestLocation(delivery.driver) : null,
      spatial: await getDeliverySpatialMetrics(prisma, delivery.id),
    };
  }

  async create(
    tenantId: string,
    createdById: string,
    input: {
      trackingCode?: string;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      dropoffAddress: string;
      dropoffLat: number;
      dropoffLng: number;
      scheduledAt?: Date;
      eta?: Date;
      driverId?: string;
      notes?: string;
    },
  ) {
    if (input.driverId) {
      const driver = await prisma.driver.findFirst({
        where: {
          id: input.driverId,
          tenantId,
        },
      });

      if (!driver) {
        throw new ApiError(400, "Driver must belong to the same tenant");
      }
    }

    const delivery = await prisma.delivery.create({
      data: {
        tenantId,
        createdById,
        trackingCode: input.trackingCode ?? generateTrackingCode(),
        driverId: input.driverId,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffAddress: input.dropoffAddress,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        status: input.driverId ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING,
        scheduledAt: input.scheduledAt,
        eta: input.eta,
        assignedAt: input.driverId ? new Date() : null,
        notes: input.notes,
      },
      include: {
        driver: true,
        proof: true,
      },
    });
    await syncDeliverySpatialColumns(prisma, delivery.id);
    await this.syncDriverAvailability(delivery.driverId);

    await this.createEvent({
      tenantId,
      deliveryId: delivery.id,
      eventType: "CREATED",
      status: delivery.status,
      message: "Delivery created",
    });

    if (delivery.driverId) {
      await this.createEvent({
        tenantId,
        deliveryId: delivery.id,
        eventType: "ASSIGNED",
        status: DeliveryStatus.ASSIGNED,
        message: "Driver assigned at creation",
      });

      emitDeliveryEvent(delivery.id, "delivery:assigned", delivery);
      emitTrackingEvent(delivery.trackingCode, "delivery:assigned", delivery);
      emitTenantEvent(tenantId, "delivery:assigned", delivery);
      await this.notify({
        tenantId,
        deliveryId: delivery.id,
        type: "delivery.assigned",
        title: "Delivery assigned",
        body: `Delivery ${delivery.trackingCode} was assigned to a driver.`,
      });
    }

    return delivery;
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
      dropoffAddress?: string;
      dropoffLat?: number;
      dropoffLng?: number;
      scheduledAt?: Date | null;
      eta?: Date | null;
      notes?: string | null;
    },
  ) {
    await this.getById(tenantId, id);

    const delivery = await prisma.delivery.update({
      where: { id },
      data: input,
      include: {
        driver: true,
        proof: true,
      },
    });
    await syncDeliverySpatialColumns(prisma, delivery.id);

    return delivery;
  }

  async delete(tenantId: string, id: string) {
    const delivery = await this.getById(tenantId, id);

    await prisma.$transaction([
      prisma.trackingEvent.deleteMany({ where: { deliveryId: id } }),
      prisma.notification.deleteMany({ where: { deliveryId: id } }),
      prisma.proofOfDelivery.deleteMany({ where: { deliveryId: id } }),
      prisma.delivery.delete({ where: { id } }),
    ]);

    await this.syncDriverAvailability(delivery.driverId);

    return { success: true };
  }

  async assignDriver(tenantId: string, id: string, driverId: string) {
    const [delivery, driver] = await Promise.all([
      this.getById(tenantId, id),
      prisma.driver.findFirst({
        where: { id: driverId, tenantId },
      }),
    ]);

    if (!driver) {
      throw new ApiError(400, "Driver must belong to the same tenant");
    }

    if (driver.status === "OFFLINE") {
      throw new ApiError(400, "Offline drivers cannot be assigned");
    }

    if (!["PENDING", "ASSIGNED"].includes(delivery.status)) {
      throw new ApiError(400, "Driver assignment is only allowed for pending or assigned deliveries");
    }

    const previousDriverId = delivery.driverId;

    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        driverId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
      },
      include: {
        driver: true,
        proof: true,
      },
    });

    await this.createEvent({
      tenantId,
      deliveryId: id,
      eventType: "ASSIGNED",
      status: DeliveryStatus.ASSIGNED,
      message: `Driver ${driver.name} assigned`,
    });

    emitDeliveryEvent(id, "delivery:assigned", updated);
    emitTrackingEvent(updated.trackingCode, "delivery:assigned", updated);
    emitTenantEvent(tenantId, "delivery:assigned", updated);

    await this.notify({
      tenantId,
      deliveryId: id,
      type: "delivery.assigned",
      title: "Delivery assigned",
      body: `Delivery ${updated.trackingCode} has been assigned to ${driver.name}.`,
    });

    await this.syncDriverAvailability(updated.driverId);

    if (previousDriverId && previousDriverId !== updated.driverId) {
      await this.syncDriverAvailability(previousDriverId);
    }

    return updated;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    input: {
      status: DeliveryStatusValue;
      message?: string;
      eta?: Date;
    },
    actor?: AuthUser,
  ) {
    const delivery = await this.getById(tenantId, id, actor);

    if (actor && isDriverRole(actor.role) && !driverUpdatableStatuses.has(input.status)) {
      throw new ApiError(403, "Drivers cannot set this delivery status");
    }

    if (!canTransitionDeliveryStatus(delivery.status, input.status)) {
      throw new ApiError(400, `Invalid delivery status transition: ${delivery.status} -> ${input.status}`);
    }

    if (["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "NEAR_DESTINATION", "DELIVERED"].includes(input.status) && !delivery.driverId) {
      throw new ApiError(400, "A driver must be assigned before advancing this delivery status");
    }

    const timestampField = getStatusTimestampField(input.status);

    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        status: input.status,
        eta: input.eta ?? undefined,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
      include: {
        driver: true,
        proof: true,
      },
    });

    await this.createEvent({
      tenantId,
      deliveryId: id,
      eventType: "STATUS_UPDATED",
      status: input.status,
      message: input.message ?? `Status changed to ${input.status}`,
    });

    emitDeliveryEvent(id, "delivery:status_updated", updated);
    emitTrackingEvent(updated.trackingCode, "delivery:status_updated", updated);
    emitTenantEvent(tenantId, "delivery:status_updated", updated);

    if (input.eta) {
      emitDeliveryEvent(id, "delivery:eta_updated", updated);
      emitTrackingEvent(updated.trackingCode, "delivery:eta_updated", updated);
      emitTenantEvent(tenantId, "delivery:eta_updated", updated);
    }

    if (input.status === "NEAR_DESTINATION") {
      await this.notify({
        tenantId,
        deliveryId: id,
        type: "driver.near_destination",
        title: "Driver near destination",
        body: `Delivery ${updated.trackingCode} is near the destination.`,
      });
    }

    if (input.status === "DELIVERED") {
      await this.notify({
        tenantId,
        deliveryId: id,
        type: "delivery.delivered",
        title: "Delivery delivered",
        body: `Delivery ${updated.trackingCode} has been delivered.`,
      });
    }

    if (input.status === "FAILED") {
      await this.notify({
        tenantId,
        deliveryId: id,
        type: "delivery.failed",
        title: "Delivery failed",
        body: `Delivery ${updated.trackingCode} has failed.`,
      });
    }

    await this.syncDriverAvailability(updated.driverId);

    return updated;
  }

  async getEvents(tenantId: string, id: string, actor?: AuthUser) {
    await this.getById(tenantId, id, actor);

    return prisma.trackingEvent.findMany({
      where: {
        tenantId,
        deliveryId: id,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async addProof(
    tenantId: string,
    id: string,
    input: {
      photoUrl?: string;
      recipientName?: string;
      notes?: string;
      otpVerified: boolean;
    },
    actor?: AuthUser,
  ) {
    await this.getById(tenantId, id, actor);

    const proof = await prisma.proofOfDelivery.upsert({
      where: { deliveryId: id },
      update: input,
      create: {
        tenantId,
        deliveryId: id,
        ...input,
      },
    });

    await this.createEvent({
      tenantId,
      deliveryId: id,
      eventType: "PROOF_UPLOADED",
      status: DeliveryStatus.DELIVERED,
      message: "Proof of delivery uploaded",
    });

    return proof;
  }

  async getPublicTracking(trackingCode: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { trackingCode },
      include: {
        driver: {
          include: {
            locations: {
              orderBy: { recordedAt: "desc" },
              take: 1,
            },
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
        proof: true,
      },
    });

    if (!delivery) {
      throw new ApiError(404, "Tracking code not found");
    }

    return {
      id: delivery.id,
      trackingCode: delivery.trackingCode,
      pickupAddress: delivery.pickupAddress,
      scheduledAt: delivery.scheduledAt,
      assignedAt: delivery.assignedAt,
      acceptedAt: delivery.acceptedAt,
      pickedUpAt: delivery.pickedUpAt,
      deliveredAt: delivery.deliveredAt,
      dropoffAddress: delivery.dropoffAddress,
      pickupLat: delivery.pickupLat,
      pickupLng: delivery.pickupLng,
      dropoffLat: delivery.dropoffLat,
      dropoffLng: delivery.dropoffLng,
      status: delivery.status,
      eta: delivery.eta,
      notes: delivery.notes,
      driverId: delivery.driverId,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
      driver: delivery.driver
        ? {
            id: delivery.driver.id,
            name: delivery.driver.name,
            status: delivery.driver.status,
            locations: delivery.driver.locations,
            latestLocation: delivery.driver.locations[0] ?? null,
          }
        : null,
      events: delivery.events,
      proof: delivery.proof,
      spatial: await getDeliverySpatialMetrics(prisma, delivery.id),
    };
  }

  async getDriverLiveMapData(
    tenantId: string,
    input?: {
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
    },
  ) {
    let driverIds: string[] | undefined;
    const distanceByDriverId = new Map<string, number>();

    if (input?.latitude != null && input.longitude != null) {
      if (!isPostgisReady()) {
        throw new ApiError(503, "Spatial filtering requires PostGIS support");
      }

      const distances = await getDriverDistancesFromPoint(prisma, {
        tenantId,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
      });

      driverIds = distances.map((distance) => distance.driverId);
      for (const distance of distances) {
        distanceByDriverId.set(distance.driverId, distance.distanceMeters);
      }

      if (driverIds.length === 0) {
        return [];
      }
    }

    const drivers = await prisma.driver.findMany({
      where: {
        tenantId,
        status: { in: ["AVAILABLE", "BUSY", "OFFLINE"] },
        ...(driverIds ? { id: { in: driverIds } } : {}),
      },
      include: {
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
        deliveries: {
          where: {
            status: { in: activeStatuses },
          },
          select: {
            id: true,
            trackingCode: true,
            status: true,
            pickupLat: true,
            pickupLng: true,
            dropoffLat: true,
            dropoffLng: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serializedDrivers = drivers.map((driver) => ({
      ...this.serializeDriverWithLatestLocation(driver),
      distanceMeters: distanceByDriverId.get(driver.id) ?? null,
    }));

    if (!driverIds) {
      return serializedDrivers;
    }

    const sortOrder = new Map(driverIds.map((driverId, index) => [driverId, index]));

    return serializedDrivers.sort(
      (left, right) => (sortOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sortOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }
}

export const deliveriesService = new DeliveriesService();
