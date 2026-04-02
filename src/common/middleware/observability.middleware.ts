import type { NextFunction, Request, Response } from "express";

import {
  decrementActiveRequests,
  incrementActiveRequests,
  recordHttpRequest,
} from "../utils/metrics";
import { logger } from "../utils/logger";

const ignoredPaths = new Set(["/health", "/health/detailed", "/metrics"]);

function getRouteLabel(request: Request) {
  const routePath =
    typeof request.route?.path === "string"
      ? request.route.path
      : Array.isArray(request.route?.path)
        ? request.route.path.join("|")
        : "";

  const route = `${request.baseUrl}${routePath}`;
  const fallback = request.originalUrl.split("?")[0] || request.path || "unknown";

  return route || fallback;
}

export function observabilityMiddleware(request: Request, response: Response, next: NextFunction) {
  const startedAt = performance.now();
  const path = request.originalUrl.split("?")[0];
  const shouldIgnore = ignoredPaths.has(path);
  let finalized = false;

  if (!shouldIgnore) {
    incrementActiveRequests();
  }

  const finalize = () => {
    if (shouldIgnore || finalized) {
      return;
    }

    finalized = true;
    decrementActiveRequests();

    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const route = getRouteLabel(request);

    recordHttpRequest({
      method: request.method,
      route,
      statusCode: response.statusCode,
      durationMs,
    });

    logger.info("HTTP request completed", {
      requestId: request.context?.requestId,
      method: request.method,
      route,
      path,
      statusCode: response.statusCode,
      durationMs,
      tenantId: request.context?.tenantId,
      userId: request.context?.user?.userId,
      ip: request.ip,
      userAgent: request.get("user-agent"),
      contentLength: Number(response.getHeader("content-length") ?? 0),
    });
  };

  response.on("finish", finalize);
  response.on("close", finalize);

  next();
}
