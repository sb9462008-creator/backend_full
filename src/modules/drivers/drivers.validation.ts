import { z } from "zod";

import { DRIVER_STATUSES } from "../../common/types/enums";

export const driverIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const createDriverSchema = {
  body: z.object({
    userId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\d{5,15}$/, "Phone number must contain digits only"),
    status: z.enum(DRIVER_STATUSES).default("AVAILABLE"),
  }).strict(),
};

export const updateDriverSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      userId: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().regex(/^\d{5,15}$/, "Phone number must contain digits only").optional(),
      status: z.enum(DRIVER_STATUSES).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
};

export const recordDriverLocationSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).strict(),
};
