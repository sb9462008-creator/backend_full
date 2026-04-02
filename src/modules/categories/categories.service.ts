import {
  DELIVERY_STATUSES,
  DRIVER_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  TRACKING_EVENT_TYPES,
  USER_ROLES,
} from "../../common/types/enums";

const VEHICLE_TYPES = ["BIKE", "MOTORBIKE", "CAR", "VAN", "TRUCK"] as const;

export class CategoriesService {
  getAll() {
    return {
      roles: USER_ROLES,
      driverStatuses: DRIVER_STATUSES,
      deliveryStatuses: DELIVERY_STATUSES,
      orderStatuses: ORDER_STATUSES,
      productCategories: PRODUCT_CATEGORIES,
      trackingEventTypes: TRACKING_EVENT_TYPES,
      notificationChannels: NOTIFICATION_CHANNELS,
      notificationTypes: NOTIFICATION_TYPES,
      vehicleTypes: VEHICLE_TYPES,
    };
  }
}

export const categoriesService = new CategoriesService();
