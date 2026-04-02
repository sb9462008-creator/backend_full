import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";

import { ApiError } from "../utils/api-error";
import { logger } from "../utils/logger";
import { recordApplicationError } from "../utils/metrics";

function buildRequestLogContext(request: Request) {
  return {
    requestId: request.context?.requestId,
    method: request.method,
    path: request.originalUrl,
    tenantId: request.context?.tenantId,
    userId: request.context?.user?.userId,
  };
}

export function errorMiddleware(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    recordApplicationError({
      source: "http",
      type: "validation_error",
    });
    logger.warn("Request validation failed", {
      ...buildRequestLogContext(request),
      issues: error.flatten(),
    });
    response.status(422).json({
      message: "Validation failed",
      errors: error.flatten(),
    });
    return;
  }

  if (error instanceof ApiError) {
    recordApplicationError({
      source: "http",
      type: `api_error_${error.statusCode}`,
    });
    logger.warn("API error handled", {
      ...buildRequestLogContext(request),
      statusCode: error.statusCode,
      details: error.details,
      errorName: error.name,
      errorMessage: error.message,
    });
    response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    recordApplicationError({
      source: "prisma",
      type: "unique_constraint_violation",
    });
    logger.warn("Prisma unique constraint violation", {
      ...buildRequestLogContext(request),
      error,
    });
    response.status(409).json({
      message: "A unique constraint was violated",
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    recordApplicationError({
      source: "http",
      type: `upload_error_${error.code.toLowerCase()}`,
    });
    logger.warn("Upload validation failed", {
      ...buildRequestLogContext(request),
      errorCode: error.code,
      errorMessage: error.message,
    });
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Uploaded file is too large"
          : "Uploaded file is invalid",
    });
    return;
  }

  recordApplicationError({
    source: "http",
    type: "unhandled_exception",
  });
  logger.exception("Unhandled request error", error, buildRequestLogContext(request));

  response.status(500).json({
    message: "Internal server error",
  });
}
