import { DeliveryStatus, OrderStatus, Prisma } from "@prisma/client";

import { env } from "../../common/utils/env";
import { logger } from "../../common/utils/logger";
import { sendMail } from "../../common/utils/mailer";
import { syncDeliverySpatialColumns } from "../../common/utils/postgis";
import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";

const warehouse = {
  address: env.WAREHOUSE_ADDRESS,
  latitude: env.WAREHOUSE_LAT,
  longitude: env.WAREHOUSE_LNG,
};

const orderInclude = {
  items: {
    include: {
      product: true,
    },
  },
  delivery: {
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
      proof: true,
    },
  },
} satisfies Prisma.OrderInclude;

const basicOrderInclude = {
  items: {
    include: {
      product: true,
    },
  },
  delivery: true,
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type BasicOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof basicOrderInclude }>;

function formatPrice(amountCents: number) {
  return new Intl.NumberFormat("mn-MN", {
    style: "currency",
    currency: "MNT",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function generateOrderNumber() {
  return ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()};
}

function generateTrackingCode() {
  return TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()};
}

function presentOrderStatus(order: OrderWithRelations) {
  if (order.status === "CANCELLED") {
    return OrderStatus.CANCELLED;
  }

  const deliveryStatus = order.delivery?.status;

  if (!deliveryStatus) {
    return order.status;
  }

  if (deliveryStatus === "DELIVERED") {
    return OrderStatus.DELIVERED;
  }

  if (["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "NEAR_DESTINATION"].includes(deliveryStatus)) {
    return OrderStatus.SHIPPED;
  }

  return OrderStatus.PROCESSING;
}

function serializeOrder(order: OrderWithRelations) {
  return {
    ...order,
    status: presentOrderStatus(order),
  };
}

function normalizeOrderWithRelations(order: OrderWithRelations | BasicOrderWithRelations): OrderWithRelations {
  const delivery = order.delivery;

  return {
    ...(order as Omit<OrderWithRelations, "delivery">),
    delivery: delivery
      ? {
          ...(delivery as NonNullable<OrderWithRelations["delivery"]>),
          events: (delivery as NonNullable<OrderWithRelations["delivery"]> & { events?: NonNullable<OrderWithRelations["delivery"]>["events"] })
            .events ?? [],
          proof: (delivery as NonNullable<OrderWithRelations["delivery"]> & { proof?: NonNullable<OrderWithRelations["delivery"]>["proof"] })
            .proof ?? null,
        }
      : null,
  };
}

export class OrdersService {
  private async findOrderWithSafeRelations(where: Prisma.OrderWhereInput) {
    try {
      const order = await prisma.order.findFirst({
        where,
        include: orderInclude,
      });

      return order ? normalizeOrderWithRelations(order) : null;
    } catch (error) {
      logger.warn("Falling back to basic order relation query", {
        where,
        error: error instanceof Error ? error.message : String(error),
      });

      const fallbackOrder = await prisma.order.findFirst({
        where,
        include: basicOrderInclude,
      });

      return fallbackOrder ? normalizeOrderWithRelations(fallbackOrder) : null;
    }
  }
private async sendPaymentCompletedEmail(input: {
    email: string;
    customerName: string;
    storefrontName: string;
    order: OrderWithRelations;
    payment: {
      method: "CARD" | "QR";
      status: "COMPLETED";
      summary: string;
    };
  }) {
    const storefrontUrl = env.FRONTEND_URL ?? "https://localhost:3000";
    const ordersUrl = ${storefrontUrl}/orders/${input.order.id};

    await sendMail({
      to: input.email,
      subject: ${input.storefrontName} - Payment completed (${input.order.orderNumber}),
      text: [
        Сайн байна уу, ${input.customerName}.,
        "",
        "Таны төлбөр амжилттай бүртгэгдлээ.",
        Захиалгын дугаар: ${input.order.orderNumber},
        Төлбөрийн төрөл: ${input.payment.method === "CARD" ? "Visa / Mastercard" : "QR төлбөр"},
        Төлбөрийн тэмдэглэл: ${input.payment.summary},
        Төлсөн дүн: ${formatPrice(input.order.totalAmountCents)},
        "",
        Захиалгын дэлгэрэнгүй: ${ordersUrl},
        "",
        "Одоо бид таны захиалгыг баталгаажуулж, хүргэлтэд бэлдэнэ.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.6;">
          <h2 style="margin-bottom: 12px;">Төлбөр амжилттай бүртгэгдлээ</h2>
          <p>Сайн байна уу, ${escapeHtml(input.customerName)}.</p>
          <p>Таны төлбөр амжилттай бүртгэгдлээ.</p>
          <p><strong>Захиалгын дугаар:</strong> ${escapeHtml(input.order.orderNumber)}</p>
          <p><strong>Төлбөрийн төрөл:</strong> ${escapeHtml(input.payment.method === "CARD" ? "Visa / Mastercard" : "QR төлбөр")}</p>
          <p><strong>Төлбөрийн мэдээлэл:</strong> ${escapeHtml(input.payment.summary)}</p>
          <p><strong>Төлсөн дүн:</strong> ${escapeHtml(formatPrice(input.order.totalAmountCents))}</p>
          <p><a href="${ordersUrl}">Захиалгын дэлгэрэнгүй харах</a></p>
          <p>Одоо бид таны захиалгыг баталгаажуулж, хүргэлтэд бэлдэнэ.</p>
        </div>
      `,
    });
  }

  private async sendOrderConfirmationEmail(input: {
    email: string;
    customerName: string;
    storefrontName: string;
    order: OrderWithRelations;
  }) {
    const storefrontUrl = env.FRONTEND_URL ?? "https://localhost:3000";
    const ordersUrl = ${storefrontUrl}/orders/${input.order.id};
    const trackingUrl = input.order.delivery?.trackingCode
      ? ${storefrontUrl}/track/${input.order.delivery.trackingCode}
      : ordersUrl;
    const itemLines = input.order.items.map((item) => {
      const lineTotal = item.unitPriceCents * item.quantity;
      return - ${item.product.name} x${item.quantity} — ${formatPrice(lineTotal)};
    });
    const htmlItemLines = input.order.items
      .map((item) => {
        const lineTotal = item.unitPriceCents * item.quantity;
        return <li>${escapeHtml(item.product.name)} x${item.quantity} — ${escapeHtml(formatPrice(lineTotal))}</li>;
      })
      .join("");
await sendMail({
      to: input.email,
      subject: ${input.storefrontName} - Order confirmed (${input.order.orderNumber}),
      text: [
        Сайн байна уу, ${input.customerName}.,
        "",
        "Таны захиалга амжилттай бүртгэгдлээ.",
        Захиалгын дугаар: ${input.order.orderNumber},
        Хяналтын код: ${input.order.delivery?.trackingCode ?? "Одоогоор үүсээгүй"},
        Хүргэлтийн хаяг: ${input.order.shippingAddress},
        "",
        "Захиалсан бараанууд:",
        ...itemLines,
        "",
        Нийт төлбөр: ${formatPrice(input.order.totalAmountCents)},
        "",
        Захиалгын дэлгэрэнгүй: ${ordersUrl},
        Хүргэлт хянах: ${trackingUrl},
        "",
        "XADE-с захиалга өгсөнд баярлалаа.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.6;">
          <h2 style="margin-bottom: 12px;">Таны захиалга баталгаажлаа</h2>
          <p>Сайн байна уу, ${escapeHtml(input.customerName)}.</p>
          <p>XADE дээр үүсгэсэн таны захиалга амжилттай бүртгэгдлээ.</p>
          <p><strong>Захиалгын дугаар:</strong> ${escapeHtml(input.order.orderNumber)}</p>
          <p><strong>Хяналтын код:</strong> ${escapeHtml(input.order.delivery?.trackingCode ?? "Одоогоор үүсээгүй")}</p>
          <p><strong>Хүргэлтийн хаяг:</strong> ${escapeHtml(input.order.shippingAddress)}</p>
          <p><strong>Захиалсан бараанууд:</strong></p>
          <ul>${htmlItemLines}</ul>
          <p><strong>Нийт төлбөр:</strong> ${escapeHtml(formatPrice(input.order.totalAmountCents))}</p>
          <p><a href="${ordersUrl}">Захиалгын дэлгэрэнгүй харах</a></p>
          <p><a href="${trackingUrl}">Хүргэлт хянах</a></p>
          <p>XADE-с захиалга өгсөнд баярлалаа.</p>
        </div>
      `,
    });
  }

  private async sendCustomerOrderEmails(input: {
    email: string;
    customerId: string;
    customerName: string;
    storefrontName: string;
    order: OrderWithRelations;
    payment?: {
      method: "CARD" | "QR";
      status: "COMPLETED";
      summary: string;
    };
  }) {
    if (input.payment?.status === "COMPLETED") {
      try {
        await this.sendPaymentCompletedEmail({
          email: input.email,
          customerName: input.customerName,
          storefrontName: input.storefrontName,
          order: input.order,
          payment: input.payment,
        });
      } catch (error) {
        logger.exception("Failed to send payment completed email", error, {
          customerId: input.customerId,
          email: input.email,
          orderId: input.order.id,
          orderNumber: input.order.orderNumber,
        });
      }
    }

    await this.sendOrderConfirmationEmail({
      email: input.email,
      customerName: input.customerName,
      storefrontName: input.storefrontName,
      order: input.order,
    });
  }

  async create(input: {
    tenantId: string;
    customerId: string;
    shippingAddress: string;
    shippingLat?: number;
    shippingLng?: number;
    pickupAddress?: string;
    pickupLat?: number;
    pickupLng?: number;
    notes?: string;
    payment?: {
      method: "CARD" | "QR";
      status: "COMPLETED";
      summary: string;
    };
    items: Array<{
      productId: string;
      quantity: number;
    }>;
  }) {
    const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];

    if (uniqueProductIds.length !== input.items.length) {
      throw new ApiError(400, "Each product may only appear once per order");
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: uniqueProductIds },
        isActive: true,
      },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new ApiError(400, "One or more products are unavailable");
    }
const customer = await prisma.user.findFirst({
      where: {
        id: input.customerId,
        tenantId: input.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new ApiError(400, "One or more products are unavailable");
      }

      if (product.stock < item.quantity) {
        throw new ApiError(400, `${product.name} does not have enough stock`);
      }
    }

    const totalAmountCents = input.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + product.priceCents * item.quantity;
    }, 0);

    const order = await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          tenantId: input.tenantId,
          createdById: input.customerId,
          trackingCode: generateTrackingCode(),
          pickupAddress: input.pickupAddress ?? warehouse.address,
          pickupLat: input.pickupLat ?? warehouse.latitude,
          pickupLng: input.pickupLng ?? warehouse.longitude,
          dropoffAddress: input.shippingAddress,
          dropoffLat: input.shippingLat ?? warehouse.latitude,
          dropoffLng: input.shippingLng ?? warehouse.longitude,
          status: DeliveryStatus.PENDING,
          notes: input.notes,
        },
      });
      await syncDeliverySpatialColumns(tx, delivery.id);

      await tx.trackingEvent.create({
        data: {
          tenantId: input.tenantId,
          deliveryId: delivery.id,
          eventType: "CREATED",
          status: DeliveryStatus.PENDING,
          message: "Delivery created for customer order",
        },
      });

      const createdOrder = await tx.order.create({
        data: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          deliveryId: delivery.id,
          orderNumber: generateOrderNumber(),
          status: OrderStatus.PLACED,
          totalAmountCents,
          shippingAddress: input.shippingAddress,
          shippingLat: input.shippingLat,
          shippingLng: input.shippingLng,
          notes: input.notes,
          items: {
            create: input.items.map((item) => {
              const product = productMap.get(item.productId)!;

              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPriceCents: product.priceCents,
              };
            }),
          },
        },
        include: basicOrderInclude,
      });

      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return normalizeOrderWithRelations(createdOrder);
    });

    void this.sendCustomerOrderEmails({
      email: customer.email,
      customerId: customer.id,
      customerName: customer.name,
      storefrontName: customer.tenant.name,
      order,
      payment: input.payment,
    }).catch((error) => {
      logger.exception("Failed to send customer order emails", error, {
        customerId: customer.id,
        email: customer.email,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    });

    return serializeOrder(order);
  }

  async listForCustomer(tenantId: string, customerId: string) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          tenantId,
          customerId,
        },
        orderBy: { createdAt: "desc" },
        include: orderInclude,
      });
return orders.map(serializeOrder);
    } catch (error) {
      logger.warn("Falling back to basic customer orders query", {
        tenantId,
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });

      const orders = await prisma.order.findMany({
        where: {
          tenantId,
          customerId,
        },
        orderBy: { createdAt: "desc" },
        include: basicOrderInclude,
      });

      return orders.map((order) => serializeOrder(normalizeOrderWithRelations(order)));
    }
  }

  async getForCustomer(tenantId: string, customerId: string, id: string) {
    const order = await this.findOrderWithSafeRelations({
      id,
      tenantId,
      customerId,
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    return serializeOrder(order);
  }
}

export const ordersService = new OrdersService();
