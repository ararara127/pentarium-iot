import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { generateClaimCode, generateDeviceToken } from "../utils/generate.js";
import { publishCommand } from "../mqtt.js";
import { deviceStatus } from "../utils/status.js";

const router = Router();

// semua endpoint di file ini butuh login
router.use(requireAuth);

// POST /api/devices  -> daftarkan device baru (simulasi "produksi" oleh Pentarium)
router.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "name wajib diisi" });
    return;
  }

  const device = await prisma.device.create({
    data: {
      name,
      tenantId: req.auth!.tenantId,
      claimCode: generateClaimCode(),
      token: generateDeviceToken(),
      claimed: false,
    },
  });

  res.status(201).json(device);
});

// GET /api/devices  -> daftar device milik tenant ini SAJA
router.get("/", async (req, res) => {
  const devices = await prisma.device.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    devices.map((d) => ({
      ...d,
      status: deviceStatus(d.lastSeenAt),
    }))
  );
});

// POST /api/devices/claim  -> klaim device pakai claimCode
router.post("/claim", async (req, res) => {
  const { claimCode } = req.body ?? {};
  if (!claimCode) {
    res.status(400).json({ error: "claimCode wajib diisi" });
    return;
  }

  const device = await prisma.device.findUnique({ where: { claimCode } });
  if (!device) {
    res.status(404).json({ error: "kode klaim tidak valid" });
    return;
  }
  if (device.claimed) {
    res.status(409).json({ error: "device sudah diklaim" });
    return;
  }

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { claimed: true, tenantId: req.auth!.tenantId },
  });

  res.json({ message: "device berhasil diklaim", device: updated });
});

// GET /api/devices/:id/metrics -> daftar metric yang tersedia dari data terakhir
router.get("/:id/metrics", async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  const latest = await prisma.telemetry.findFirst({
    where: { deviceId: device.id },
    orderBy: { ts: "desc" },
  });
  if (!latest) {
    res.json([]);
    return;
  }

  const data = latest.data as Record<string, unknown>;
  res.json(Object.keys(data).filter((k) => typeof data[k] === "number"));
});

// POST /api/devices/:id/command -> kirim perintah ke device lewat MQTT
router.post("/:id/command", async (req, res) => {
  const { command, value } = req.body ?? {};

  if (!command || typeof command !== "string") {
    res.status(400).json({ error: "command wajib diisi" });
    return;
  }

  const device = await prisma.device.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  try {
    publishCommand(device.token, {
      command,
      value: value ?? null,
      at: new Date().toISOString(),
    });
    res.json({ message: `Perintah "${command}" terkirim ke ${device.name}` });
  } catch {
    res.status(503).json({ error: "Broker MQTT tidak tersambung" });
  }
});

export default router;
