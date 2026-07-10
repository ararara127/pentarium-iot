import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/telemetry/:deviceId?limit=50
// ambil data terbaru satu device (buat line chart)
router.get("/:deviceId", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);

  // pastikan device ini milik tenant si pemanggil
  const device = await prisma.device.findFirst({
    where: { id: req.params.deviceId, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  const rows = await prisma.telemetry.findMany({
    where: { deviceId: device.id },
    orderBy: { ts: "desc" },
    take: limit,
  });
  

  // dibalik biar urut lama -> baru (enak buat chart)
  res.json(
    rows.reverse().map((row) => ({
      id: row.id.toString(),
      ts: row.ts,
      data: row.data,
    }))
  );
});

export default router;