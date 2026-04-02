import type { NextFunction, Request, Response } from "express";

import type { UserRoleValue } from "../types/enums";
import { ApiError } from "../utils/api-error";

export function roleGuard(roles: UserRoleValue[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const role = request.context?.user?.role;

    if (!role) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(role)) {
      next(new ApiError(403, "You do not have access to this resource"));
      return;
    }

    next();
  };
}
