import type { UserRoleValue } from "../types/enums";

const adminRoles = new Set<UserRoleValue>(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]);

export function isAdminRole(role: UserRoleValue | undefined | null): role is UserRoleValue {
  return role != null && adminRoles.has(role);
}

export function isDriverRole(role: UserRoleValue | undefined | null): role is "DRIVER" {
  return role === "DRIVER";
}

export function isCustomerRole(role: UserRoleValue | undefined | null): role is "CUSTOMER" {
  return role === "CUSTOMER";
}
