import { z } from "zod";

import { USER_ROLES } from "../../common/types/enums";

export const userIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const createUserSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(100),
    role: z.enum(USER_ROLES),
    isActive: z.boolean().optional(),
  }).strict(),
};

export const updateUserSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().max(200).optional(),
      password: z.string().min(8).max(100).optional(),
      role: z.enum(USER_ROLES).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
};
