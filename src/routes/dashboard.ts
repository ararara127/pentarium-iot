import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { deviceStatus } from "../utils/status.js";

const router = Router();
router.use(requireAuth);

// GET /api/dashboard  -> ringkasan untuk halaman utama
router.get("/", async (req, res) => {
  const tenantId = req.auth!.tenantId;

  const devices = await prisma.device.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  const online = devices.filter((d) => deviceStatus(d.lastSeenAt) === "online").length;

  res.json({
    totalDevices: devices.length,
    online,
    offline: devices.length - online,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      claimed: d.claimed,
      lastSeenAt: d.lastSeenAt,
      status: deviceStatus(d.lastSeenAt),
    })),
  });
});

export default router;
