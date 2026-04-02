import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(20),
}).strict();

export const createOrderSchema = {
  body: z.object({
    items: z.array(orderItemSchema).min(1).max(20),
    shippingAddress: z.string().trim().min(5).max(240),
    shippingLat: z.coerce.number().min(-90).max(90).optional(),
    shippingLng: z.coerce.number().min(-180).max(180).optional(),
    pickupAddress: z.string().trim().min(5).max(240).optional(),
    pickupLat: z.coerce.number().min(-90).max(90).optional(),
    pickupLng: z.coerce.number().min(-180).max(180).optional(),
    notes: z.string().trim().max(500).optional(),
    payment: z.object({
      method: z.enum(["CARD", "QR"]),
      status: z.enum(["COMPLETED"]),
      summary: z.string().trim().min(5).max(160),
    }).optional(),
  }).strict(),
};

export const orderIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};
