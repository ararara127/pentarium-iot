import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const TYPES = ["chart", "gauge", "stat", "text", "button"];

// GET /api/widgets
router.get("/", async (req, res) => {
  const widgets = await prisma.dashboardWidget.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { position: "asc" },
    include: { device: { select: { name: true } } },
  });
  res.json(widgets);
});

// PATCH /api/widgets/reorder  (HARUS di atas route /:id)
router.patch("/reorder", async (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: "ids harus berupa array" });
    return;
  }

  await prisma.$transaction(
    ids.map((id: string, index: number) =>
      prisma.dashboardWidget.updateMany({
        where: { id, tenantId: req.auth!.tenantId },
        data: { position: index },
      })
    )
  );
  res.json({ message: "urutan diperbarui" });
});

// POST /api/widgets
router.post("/", async (req, res) => {
  const { type, title, deviceId, metric, config, width } = req.body ?? {};

  if (!type || !title) {
    res.status(400).json({ error: "type dan title wajib diisi" });
    return;
  }
  if (!TYPES.includes(type)) {
    res.status(400).json({ error: `type harus: ${TYPES.join(", ")}` });
    return;
  }

  // text & button tidak butuh device/metric (button masih placeholder di FE)
  const butuhDevice = type !== "text";
  const butuhMetric = type !== "text" && type !== "button";
  if (butuhDevice) {
    if (!deviceId) {
      res.status(400).json({ error: "deviceId wajib untuk widget ini" });
      return;
    }
    if (butuhMetric && !metric) {
      res.status(400).json({ error: "metric wajib untuk widget ini" });
      return;
    }
    const device = await prisma.device.findFirst({
      where: { id: deviceId, tenantId: req.auth!.tenantId },
    });
    if (!device) {
      res.status(404).json({ error: "device tidak ditemukan" });
      return;
    }
  }

  const last = await prisma.dashboardWidget.findFirst({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { position: "desc" },
  });

  const widget = await prisma.dashboardWidget.create({
    data: {
      tenantId: req.auth!.tenantId,
      type,
      title,
      deviceId: butuhDevice ? deviceId : null,
      metric: butuhMetric ? metric : null,
      config: config ?? undefined,
      width: width === "full" ? "full" : "half",
      position: (last?.position ?? -1) + 1,
    },
  });
  res.status(201).json(widget);
});

// PATCH /api/widgets/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.dashboardWidget.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: "widget tidak ditemukan" });
    return;
  }

  const { title, metric, config, width } = req.body ?? {};
  const updated = await prisma.dashboardWidget.update({
    where: { id: existing.id },
    data: {
      title: title ?? existing.title,
      metric: metric ?? existing.metric,
      config: config ?? existing.config ?? undefined,
      width: width === "full" || width === "half" ? width : existing.width,
    },
  });
  res.json(updated);
});

// DELETE /api/widgets/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.dashboardWidget.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: "widget tidak ditemukan" });
    return;
  }
  await prisma.dashboardWidget.delete({ where: { id: existing.id } });
  res.json({ message: "widget dihapus" });
});

export default router;
