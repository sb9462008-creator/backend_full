import { z } from "zod";

import { DELIVERY_STATUSES } from "../../common/types/enums";

const futureDateSchema = z
  .coerce
  .date()
  .refine((value) => value.getTime() > Date.now(), "Scheduled date must be in the future");

export const deliveryIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const trackingCodeParamSchema = {
  params: z.object({
    trackingCode: z.string().trim().min(4).max(80),
  }).strict(),
};

export const driverLiveMapQuerySchema = {
  query: z
    .object({
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      radiusMeters: z.coerce.number().positive().max(500_000).optional(),
    })
    .strict()
    .refine(
      (value) =>
        (value.latitude == null && value.longitude == null && value.radiusMeters == null) ||
        (value.latitude != null && value.longitude != null),
      "Latitude and longitude must be provided together",
    ),
};

export const createDeliverySchema = {
  body: z.object({
    trackingCode: z.string().trim().min(4).max(80).optional(),
    pickupAddress: z.string().trim().min(5).max(500),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropoffAddress: z.string().trim().min(5).max(500),
    dropoffLat: z.number().min(-90).max(90),
    dropoffLng: z.number().min(-180).max(180),
    scheduledAt: futureDateSchema.optional(),
    eta: z.coerce.date().optional(),
    driverId: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
  }).strict(),
};

export const updateDeliverySchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      pickupAddress: z.string().trim().min(5).max(500).optional(),
      pickupLat: z.number().min(-90).max(90).optional(),
      pickupLng: z.number().min(-180).max(180).optional(),
      dropoffAddress: z.string().trim().min(5).max(500).optional(),
      dropoffLat: z.number().min(-90).max(90).optional(),
      dropoffLng: z.number().min(-180).max(180).optional(),
      scheduledAt: futureDateSchema.nullable().optional(),
      eta: z.coerce.date().nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
};

export const assignDriverSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    driverId: z.string().uuid(),
  }),
};

export const updateStatusSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(DELIVERY_STATUSES),
    message: z.string().trim().max(1000).optional(),
    eta: z.coerce.date().optional(),
  }).strict(),
};

export const proofBodySchema = z.object({
  recipientName: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  otpVerified: z.coerce.boolean().default(false),
}).strict();
