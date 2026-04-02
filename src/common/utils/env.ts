import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  FORCE_HTTPS: z.string().optional().transform((value) => value === "true"),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().optional().transform((value) => value || undefined),
  HTTPS_CERT_PATH: z.string().optional().transform((value) => value || undefined),
  HTTPS_KEY_PATH: z.string().optional().transform((value) => value || undefined),
  SMTP_HOST: z.string().optional().transform((value) => value || undefined),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().transform((value) => value || undefined),
  SMTP_PASS: z.string().optional().transform((value) => value || undefined),
  SMTP_FROM: z.string().email().default("notifications@hurgelt.local"),
  UPLOAD_DIR: z.string().default("uploads"),
  STOREFRONT_TENANT_SLUG: z.string().default("demo-company"),
  WAREHOUSE_ADDRESS: z.string().default("Hurgelt Warehouse, Ulaanbaatar"),
  OPENAI_API_KEY: z.string().optional().transform((value) => value || undefined),
  WAREHOUSE_LAT: z.coerce.number().min(-90).max(90).default(47.9184),
  WAREHOUSE_LNG: z.coerce.number().min(-180).max(180).default(106.9177),
});

export const env = envSchema.parse(process.env);
