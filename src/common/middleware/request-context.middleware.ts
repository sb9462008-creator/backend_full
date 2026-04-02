import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction) {
  request.context = {
    requestId: request.header("x-request-id") || randomUUID(),
    tenantId: request.header("x-tenant-id") || undefined,
    user: request.context?.user,
  };

  response.setHeader("x-request-id", request.context.requestId);
  next();
}
