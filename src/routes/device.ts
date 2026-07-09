import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { generateClaimCode, generateDeviceToken } from "../utils/generate.js";

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
  res.json(devices);
});

// GET /api/devices/:id  -> detail satu device (tetap dibatasi tenant)
router.get("/:id", async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });

  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }
  res.json(device);
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

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { claimed: true },
  });

  res.json({ message: "device berhasil diklaim", device: updated });
});

export default router;