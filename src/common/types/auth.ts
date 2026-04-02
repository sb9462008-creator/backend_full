import type { UserRoleValue } from "./enums";

export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRoleValue;
}
