import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(server: Server) {
  io = server;
}

export function getSocketServer() {
  if (!io) {
    throw new Error("Socket server is not initialized");
  }

  return io;
}

export function emitTenantEvent(tenantId: string, event: string, payload: unknown) {
  io?.to(`tenant:${tenantId}`).emit(event, payload);
}

export function emitDeliveryEvent(deliveryId: string, event: string, payload: unknown) {
  io?.to(`delivery:${deliveryId}`).emit(event, payload);
}

export function emitTrackingEvent(trackingCode: string, event: string, payload: unknown) {
  io?.to(`tracking:${trackingCode}`).emit(event, payload);
}

export function emitDriverEvent(driverId: string, event: string, payload: unknown) {
  io?.to(`driver:${driverId}`).emit(event, payload);
}
