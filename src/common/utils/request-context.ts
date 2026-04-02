import type { Request } from "express";

import { ApiError } from "./api-error";

export function requireTenantId(request: Request) {
  const tenantId = request.context?.tenantId;

  if (!tenantId) {
    throw new ApiError(400, "x-tenant-id header is required");
  }

  return tenantId;
}

export function requireUser(request: Request) {
  const user = request.context?.user;

  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  return user;
}
