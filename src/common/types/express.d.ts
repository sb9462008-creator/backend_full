import type { AuthUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      context?: {
        requestId: string;
        tenantId?: string;
        user?: AuthUser;
      };
    }
  }
}

export {};
