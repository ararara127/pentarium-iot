export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function deviceStatus(lastSeenAt: Date | null): "online" | "offline" {
  if (!lastSeenAt) return "offline";
  return lastSeenAt > new Date(Date.now() - ONLINE_WINDOW_MS) ? "online" : "offline";
}
