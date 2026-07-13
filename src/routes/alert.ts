import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/alerts -> riwayat alert terbaru
router.get("/", async (req, res) => {
  const alerts = await prisma.alert.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { device: { select: { name: true } } },
  });
  res.json(alerts);
});

// GET /api/alerts/rules -> daftar aturan
router.get("/rules", async (req, res) => {
  const rules = await prisma.alertRule.findMany({
    where: { tenantId: req.auth!.tenantId },
    include: { device: { select: { name: true } } },
  });
  res.json(rules);
});

// POST /api/alerts/rules -> bikin aturan baru
router.post("/rules", async (req, res) => {
  const { deviceId, metric, operator, threshold } = req.body ?? {};

  if (!deviceId || !metric || !operator || threshold === undefined) {
    res.status(400).json({ error: "deviceId, metric, operator, threshold wajib" });
    return;
  }
  if (operator !== ">" && operator !== "<") {
    res.status(400).json({ error: "operator harus > atau <" });
    return;
  }

  // pastikan device milik tenant ini
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  const rule = await prisma.alertRule.create({
    data: {
      tenantId: req.auth!.tenantId,
      deviceId,
      metric,
      operator,
      threshold: Number(threshold),
    },
  });
  res.status(201).json(rule);
});

// DELETE /api/alerts/rules/:id
router.delete("/rules/:id", async (req, res) => {
  const rule = await prisma.alertRule.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!rule) {
    res.status(404).json({ error: "rule tidak ditemukan" });
    return;
  }
  await prisma.alert.deleteMany({ where: { ruleId: rule.id } });
  await prisma.alertRule.delete({ where: { id: rule.id } });
  res.json({ message: "rule dihapus" });
});

export default router;