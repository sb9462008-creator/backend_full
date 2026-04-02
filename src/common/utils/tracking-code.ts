export function generateTrackingCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HRG-${Date.now()}-${random}`;
}
