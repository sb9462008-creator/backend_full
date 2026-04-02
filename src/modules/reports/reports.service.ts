import { DeliveryStatus } from "@prisma/client";

import { prisma } from "../../prisma/client";

const activeStatuses: DeliveryStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "NEAR_DESTINATION",
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export class ReportsService {
  async getDashboardSummary(tenantId: string) {
    const today = startOfToday();

    const [totalDeliveriesToday, activeDeliveries, deliveredToday, failedToday, deliveredWithEta, drivers] =
      await Promise.all([
        prisma.delivery.count({
          where: {
            tenantId,
            createdAt: { gte: today },
          },
        }),
        prisma.delivery.count({
          where: {
            tenantId,
            status: { in: activeStatuses },
          },
        }),
        prisma.delivery.findMany({
          where: {
            tenantId,
            status: DeliveryStatus.DELIVERED,
            deliveredAt: { gte: today },
          },
          select: {
            id: true,
            createdAt: true,
            deliveredAt: true,
            eta: true,
          },
        }),
        prisma.delivery.count({
          where: {
            tenantId,
            updatedAt: { gte: today },
            status: DeliveryStatus.FAILED,
          },
        }),
        prisma.delivery.findMany({
          where: {
            tenantId,
            status: DeliveryStatus.DELIVERED,
            deliveredAt: { not: null },
            eta: { not: null },
          },
          select: {
            deliveredAt: true,
            eta: true,
          },
        }),
        prisma.driver.findMany({
          where: { tenantId },
          include: {
            deliveries: {
              where: {
                status: { in: activeStatuses },
              },
              select: { id: true },
            },
          },
        }),
      ]);

    const averageDeliveryTimeMinutes =
      deliveredToday.length > 0
        ? Math.round(
            deliveredToday.reduce((sum, item) => {
              const deliveredAt = item.deliveredAt ?? item.createdAt;
              return sum + (deliveredAt.getTime() - item.createdAt.getTime()) / 60000;
            }, 0) / deliveredToday.length,
          )
        : 0;

    const onTimeRate =
      deliveredWithEta.length > 0
        ? Math.round(
            (deliveredWithEta.filter(
              (item) =>
                item.deliveredAt !== null &&
                item.eta !== null &&
                item.deliveredAt.getTime() <= item.eta.getTime(),
            ).length /
              deliveredWithEta.length) *
              100,
          )
        : 0;

    const driverUtilization =
      drivers.length > 0
        ? Math.round((drivers.filter((driver) => driver.deliveries.length > 0).length / drivers.length) * 100)
        : 0;

    return {
      totalDeliveriesToday,
      activeDeliveries,
      deliveredToday: deliveredToday.length,
      failedToday,
      onTimeRate,
      averageDeliveryTimeMinutes,
      driverUtilization,
    };
  }

  async getDeliveriesReport(tenantId: string) {
    const deliveriesByStatus = await prisma.delivery.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: {
        status: true,
      },
    });

    const recentDeliveries = await prisma.delivery.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return {
      deliveriesByStatus: deliveriesByStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      recentDeliveries,
    };
  }

  async getDriversReport(tenantId: string) {
    return prisma.driver.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            updatedAt: true,
          },
        },
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });
  }
}

export const reportsService = new ReportsService();
