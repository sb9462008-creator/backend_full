import { NotificationChannel } from "@prisma/client";

import type { AuthUser } from "../../common/types/auth";
import { isAdminRole } from "../../common/utils/authorization";
import { prisma } from "../../prisma/client";
import { emitTenantEvent } from "../../common/utils/socket";

export class NotificationsService {
  async listForActor(tenantId: string, actor: AuthUser) {
    const notifications = await prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        delivery: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            driver: {
              select: {
                userId: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (isAdminRole(actor.role)) {
      return notifications.map(({ delivery, ...notification }) => ({
        ...notification,
        delivery: delivery
          ? {
              id: delivery.id,
              trackingCode: delivery.trackingCode,
              status: delivery.status,
            }
          : null,
      }));
    }

    return notifications
      .filter(
        (notification) =>
          notification.userId === actor.userId ||
          notification.delivery?.driver?.userId === actor.userId,
      )
      .map(({ delivery, ...notification }) => ({
        ...notification,
        delivery: delivery
          ? {
              id: delivery.id,
              trackingCode: delivery.trackingCode,
              status: delivery.status,
            }
          : null,
      }));
  }

  async createInAppNotification(input: {
    tenantId: string;
    userId?: string;
    deliveryId?: string;
    type: string;
    title: string;
    body: string;
  }) {
    const notification = await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        deliveryId: input.deliveryId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel: NotificationChannel.IN_APP,
      },
    });

    emitTenantEvent(input.tenantId, "notification:new", notification);
    return notification;
  }
}

export const notificationsService = new NotificationsService();
