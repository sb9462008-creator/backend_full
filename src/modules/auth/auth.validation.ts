import { z } from "zod";

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(100),
  }).strict(),
};

export const registerDriverSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().regex(/^\d{5,15}$/, "Phone number must contain digits only"),
    password: z.string().min(8).max(100),
  }).strict(),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(100),
  }).strict(),
};
