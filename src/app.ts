import path from "node:path";

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { observabilityMiddleware } from "./common/middleware/observability.middleware";
import { env } from "./common/utils/env";
import { errorMiddleware } from "./common/middleware/error.middleware";
import { notFoundMiddleware } from "./common/middleware/not-found.middleware";
import { requestContextMiddleware } from "./common/middleware/request-context.middleware";
import { getDetailedHealth } from "./common/utils/health";
import { renderPrometheusMetrics } from "./common/utils/metrics";
import authRoutes from "./modules/auth/auth.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import deliveriesRoutes from "./modules/deliveries/deliveries.routes";
import driversRoutes from "./modules/drivers/drivers.routes";
import filesRoutes from "./modules/files/files.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import productsRoutes from "./modules/products/products.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import usersRoutes from "./modules/users/users.routes";
import aiRoutes from "./modules/ai/ai.routes";

export const app = express();
const uploadRoot = path.resolve(env.UPLOAD_DIR);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Try again later.",
  },
});

const publicTrackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many tracking requests. Try again later.",
  },
});

app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use((request, response, next) => {
  if (!env.FORCE_HTTPS || request.secure) {
    next();
    return;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const isAlreadyHttps =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) === "https";

  if (isAlreadyHttps) {
    next();
    return;
  }

  if (!request.headers.host) {
    next();
    return;
  }

  response.redirect(308, `https://${request.headers.host}${request.originalUrl}`);
});

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL ?? true,
    credentials: true,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(requestContextMiddleware);
app.use(observabilityMiddleware);
app.use("/auth", authLimiter);
app.use("/api/v1/auth", authLimiter);
app.use("/deliveries/tracking", publicTrackingLimiter);
app.use("/api/v1/deliveries/tracking", publicTrackingLimiter);
app.use(
  "/uploads",
  express.static(uploadRoot, {
    dotfiles: "deny",
    index: false,
    fallthrough: false,
    setHeaders: (response) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cache-Control", "private, max-age=3600");
    },
  }),
);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "hurgelt-backend",
  });
});

app.get("/health/detailed", async (_request, response) => {
  const report = await getDetailedHealth();
  const statusCode = report.status === "ok" ? 200 : 503;

  response.status(statusCode).json(report);
});

app.get("/metrics", (_request, response) => {
  response.type("text/plain").send(renderPrometheusMetrics());
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/drivers", driversRoutes);
app.use("/deliveries", deliveriesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/reports", reportsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/files", filesRoutes);
app.use("/categories", categoriesRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/ai", aiRoutes);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/drivers", driversRoutes);
app.use("/api/v1/deliveries", deliveriesRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/files", filesRoutes);
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/products", productsRoutes);
app.use("/api/v1/orders", ordersRoutes);
app.use("/api/v1/ai", aiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
