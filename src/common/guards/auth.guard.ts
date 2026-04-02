import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/api-error";
import { verifyToken } from "../utils/jwt";

export function authGuard(request: Request, _response: Response, next: NextFunction) {
  try {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new ApiError(401, "Bearer token is required");
    }

    const token = authorization.slice("Bearer ".length);
    const user = verifyToken(token);

    if (request.context?.tenantId && request.context.tenantId !== user.tenantId) {
      throw new ApiError(403, "Tenant header does not match the authenticated user");
    }

    request.context = {
      requestId: request.context?.requestId ?? "",
      tenantId: user.tenantId,
      user,
    };

    next();
  } catch (error) {
    next(error);
  }
}
