import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/dashboard  -> ringkasan untuk halaman utama
router.get("/", async (req, res) => {
  const tenantId = req.auth!.tenantId;

  // device dianggap "online" kalau kirim data <= 2 menit terakhir
  const ONLINE_WINDOW_MS = 2 * 60 * 1000;
  const threshold = new Date(Date.now() - ONLINE_WINDOW_MS);

  const devices = await prisma.device.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  const online = devices.filter(
    (d) => d.lastSeenAt && d.lastSeenAt > threshold
  ).length;

  res.json({
    totalDevices: devices.length,
    online,
    offline: devices.length - online,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      claimed: d.claimed,
      lastSeenAt: d.lastSeenAt,
      status: d.lastSeenAt && d.lastSeenAt > threshold ? "online" : "offline",
    })),
  });
});

export default router;