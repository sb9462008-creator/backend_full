export const USER_ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER", "CUSTOMER"] as const;
export const DRIVER_STATUSES = ["AVAILABLE", "BUSY", "OFFLINE"] as const;
export const DELIVERY_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "NEAR_DESTINATION",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
] as const;
export const ORDER_STATUSES = ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export const PRODUCT_CATEGORIES = ["CPU", "GPU", "MOTHERBOARD", "RAM", "SSD", "POWER_SUPPLY", "CASE", "COOLER"] as const;
export const TRACKING_EVENT_TYPES = ["CREATED", "ASSIGNED", "STATUS_UPDATED", "LOCATION_UPDATED", "PROOF_UPLOADED"] as const;
export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const;
export const NOTIFICATION_TYPES = [
  "delivery.assigned",
  "delivery.status_changed",
  "driver.near_destination",
  "delivery.delivered",
  "delivery.failed",
] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];
export type DriverStatusValue = (typeof DRIVER_STATUSES)[number];
export type DeliveryStatusValue = (typeof DELIVERY_STATUSES)[number];
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export type TrackingEventTypeValue = (typeof TRACKING_EVENT_TYPES)[number];
export type NotificationChannelValue = (typeof NOTIFICATION_CHANNELS)[number];
