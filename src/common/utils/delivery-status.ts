import type { DeliveryStatusValue } from "../types/enums";

const forwardTransitions: Record<DeliveryStatusValue, DeliveryStatusValue[]> = {
  PENDING: ["ASSIGNED", "FAILED", "RETURNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "FAILED", "RETURNED", "CANCELLED"],
  ACCEPTED: ["PICKED_UP", "FAILED", "RETURNED", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED", "RETURNED", "CANCELLED"],
  IN_TRANSIT: ["NEAR_DESTINATION", "FAILED", "RETURNED", "CANCELLED"],
  NEAR_DESTINATION: ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"],
  DELIVERED: [],
  FAILED: [],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransitionDeliveryStatus(
  from: DeliveryStatusValue,
  to: DeliveryStatusValue,
) {
  if (from === to) {
    return true;
  }

  return forwardTransitions[from].includes(to);
}

export function getStatusTimestampField(status: DeliveryStatusValue) {
  switch (status) {
    case "ASSIGNED":
      return "assignedAt";
    case "ACCEPTED":
      return "acceptedAt";
    case "PICKED_UP":
      return "pickedUpAt";
    case "DELIVERED":
      return "deliveredAt";
    default:
      return null;
  }
}
