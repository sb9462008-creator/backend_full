import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import process from "node:process";

import { Server, type Socket } from "socket.io";

import { app } from "./app";
import { isAdminRole, isCustomerRole, isDriverRole } from "./common/utils/authorization";
import type { AuthUser } from "./common/types/auth";
import { verifyToken } from "./common/utils/jwt";
import { env } from "./common/utils/env";
import { logger } from "./common/utils/logger";
import { isMailerConfigured } from "./common/utils/mailer";
import {
  recordApplicationError,
  recordSocketConnected,
  recordSocketDisconnected,
} from "./common/utils/metrics";
import { initializePostgis } from "./common/utils/postgis";
import { redis } from "./common/utils/redis";
import { setSocketServer } from "./common/utils/socket";
import { prisma } from "./prisma/client";

function extractSocketToken(socket: Socket) {
  const handshakeToken =
    typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : undefined;
  const authorizationHeader =
    typeof socket.handshake.headers.authorization === "string"
      ? socket.handshake.headers.authorization
      : undefined;

  if (handshakeToken) {
    return handshakeToken;
  }

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length);
  }

  return undefined;
}

async function bootstrap() {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

  await prisma.$connect();
  await initializePostgis(prisma);
  logger.info("Database connection established");

  try {
    await redis.ping();
    logger.info("Redis ping succeeded at startup");
  } catch (error) {
    recordApplicationError({
      source: "redis",
      type: "startup_ping_failed",
    });
    logger.exception("Redis ping failed at startup", error);
  }

  if (!isMailerConfigured) {
    logger.warn("SMTP is not configured; signup emails will not be delivered to real inboxes");
  }

  const useHttps = Boolean(env.HTTPS_CERT_PATH && env.HTTPS_KEY_PATH);
  const serverProtocol = useHttps ? "https" : "http";
  const httpServer = useHttps
    ? https.createServer(
        {
          cert: fs.readFileSync(env.HTTPS_CERT_PATH!, "utf8"),
          key: fs.readFileSync(env.HTTPS_KEY_PATH!, "utf8"),
        },
        app,
      )
    : http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL ?? "*",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = extractSocketToken(socket);

      if (!token) {
        next();
        return;
      }

      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  setSocketServer(io);

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthUser | undefined;

    recordSocketConnected();
    logger.info("Socket client connected", {
      socketId: socket.id,
      userId: user?.userId,
      tenantId: user?.tenantId,
    });

    const rejectSubscription = (message: string) => {
      socket.emit("socket:error", { message });
    };

    socket.on("tracking:subscribe", async (trackingCode: string) => {
      try {
        if (typeof trackingCode !== "string" || trackingCode.trim().length < 4 || trackingCode.trim().length > 80) {
          rejectSubscription("Invalid tracking code");
          return;
        }

        const delivery = await prisma.delivery.findUnique({
          where: { trackingCode: trackingCode.trim() },
          select: { id: true },
        });

        if (!delivery) {
          rejectSubscription("Tracking code not found");
          return;
        }

        socket.join(`tracking:${trackingCode.trim()}`);
      } catch (error) {
        logger.exception("Socket tracking subscription failed", error, {
          socketId: socket.id,
        });
        rejectSubscription("Unable to subscribe to tracking updates");
      }
    });

    socket.on("tenant:subscribe", (tenantId: string) => {
      if (!user || !isAdminRole(user.role) || user.tenantId !== tenantId) {
        rejectSubscription("Unauthorized tenant subscription");
        return;
      }

      socket.join(`tenant:${tenantId}`);
    });

    socket.on("delivery:subscribe", async (deliveryId: string) => {
      try {
        if (!user) {
          rejectSubscription("Authentication required");
          return;
        }

        const delivery = await prisma.delivery.findFirst({
          where: {
            id: deliveryId,
            tenantId: user.tenantId,
          },
          select: {
            id: true,
            createdById: true,
            driver: {
              select: {
                userId: true,
              },
            },
            order: {
              select: {
                customerId: true,
              },
            },
          },
        });

        if (!delivery) {
          rejectSubscription("Delivery not found");
          return;
        }

        const canJoin =
          isAdminRole(user.role) ||
          (isDriverRole(user.role) && delivery.driver?.userId === user.userId) ||
          (isCustomerRole(user.role) &&
            ((delivery.order?.customerId ?? delivery.createdById) === user.userId));

        if (!canJoin) {
          rejectSubscription("Unauthorized delivery subscription");
          return;
        }

        socket.join(`delivery:${deliveryId}`);
      } catch (error) {
        logger.exception("Socket delivery subscription failed", error, {
          socketId: socket.id,
          userId: user?.userId,
        });
        rejectSubscription("Unable to subscribe to delivery updates");
      }
    });

    socket.on("driver:subscribe", async (driverId: string) => {
      try {
        if (!user) {
          rejectSubscription("Authentication required");
          return;
        }

        const driver = await prisma.driver.findFirst({
          where: {
            id: driverId,
            tenantId: user.tenantId,
          },
          select: {
            userId: true,
          },
        });

        if (!driver) {
          rejectSubscription("Driver not found");
          return;
        }

        const canJoin =
          isAdminRole(user.role) ||
          (isDriverRole(user.role) && driver.userId === user.userId);

        if (!canJoin) {
          rejectSubscription("Unauthorized driver subscription");
          return;
        }

        socket.join(`driver:${driverId}`);
      } catch (error) {
        logger.exception("Socket driver subscription failed", error, {
          socketId: socket.id,
          userId: user?.userId,
        });
        rejectSubscription("Unable to subscribe to driver updates");
      }
    });

    socket.on("disconnect", (reason) => {
      recordSocketDisconnected();
      logger.info("Socket client disconnected", {
        socketId: socket.id,
        reason,
      });
    });
  });

  const server = httpServer.listen(env.PORT, () => {
    logger.info("API server listening", {
      port: env.PORT,
      environment: env.NODE_ENV,
      protocol: serverProtocol,
    });
  });

  const shutdown = async () => {
    logger.info("Shutting down server");
    io.close();
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      logger.info("Server shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", (error) => {
    recordApplicationError({
      source: "process",
      type: "uncaught_exception",
    });
    logger.exception("Uncaught exception", error);
  });
  process.on("unhandledRejection", (reason) => {
    recordApplicationError({
      source: "process",
      type: "unhandled_rejection",
    });
    logger.exception("Unhandled promise rejection", reason);
  });
}

bootstrap().catch(async (error) => {
  recordApplicationError({
    source: "process",
    type: "bootstrap_failure",
  });
  logger.exception("Failed to bootstrap application", error);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(1);
});
