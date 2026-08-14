import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// pilihan rentang waktu + ukuran bucket agregasi
const RANGES: Record<string, { ms: number; bucketMs: number }> = {
  "15m": { ms: 15 * 60 * 1000, bucketMs: 0 }, // mentah
  "1h": { ms: 60 * 60 * 1000, bucketMs: 60 * 1000 }, // rata-rata per menit
  "24h": { ms: 24 * 60 * 60 * 1000, bucketMs: 15 * 60 * 1000 }, // per 15 menit
  "7d": { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 }, // per jam
};

type Row = { ts: Date; data: unknown };

function aggregate(rows: Row[], bucketMs: number) {
  if (bucketMs === 0) {
    return rows.map((r) => ({ ts: r.ts, data: r.data }));
  }

  const buckets = new Map<
    number,
    { sums: Record<string, number>; counts: Record<string, number> }
  >();

  for (const row of rows) {
    const key = Math.floor(row.ts.getTime() / bucketMs) * bucketMs;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { sums: {}, counts: {} };
      buckets.set(key, bucket);
    }

    const data = row.data as Record<string, unknown>;
    for (const [metric, value] of Object.entries(data)) {
      if (typeof value !== "number") continue;
      bucket.sums[metric] = (bucket.sums[metric] ?? 0) + value;
      bucket.counts[metric] = (bucket.counts[metric] ?? 0) + 1;
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, bucket]) => {
      const data: Record<string, number> = {};
      for (const metric of Object.keys(bucket.sums)) {
        data[metric] = +(bucket.sums[metric] / bucket.counts[metric]).toFixed(2);
      }
      return { ts: new Date(key), data };
    });
}

// GET /api/telemetry/:deviceId?range=1h  (atau ?limit=50 untuk mode lama)
router.get("/:deviceId", async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.deviceId, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  const rangeKey = typeof req.query.range === "string" ? req.query.range : null;

  // mode lama: pakai limit (tetap didukung supaya widget existing tidak rusak)
  if (!rangeKey) {
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const rows = await prisma.telemetry.findMany({
      where: { deviceId: device.id },
      orderBy: { ts: "desc" },
      take: limit,
    });
    res.json(
      rows.reverse().map((row) => ({
        id: row.id.toString(),
        ts: row.ts,
        data: row.data,
      }))
    );
    return;
  }

  const range = RANGES[rangeKey];
  if (!range) {
    res.status(400).json({
      error: `range harus salah satu dari: ${Object.keys(RANGES).join(", ")}`,
    });
    return;
  }

  const since = new Date(Date.now() - range.ms);

  const rows = await prisma.telemetry.findMany({
    where: { deviceId: device.id, ts: { gte: since } },
    orderBy: { ts: "asc" },
    select: { ts: true, data: true },
    take: 20000, // pengaman kalau data sangat banyak
  });

  const result = aggregate(rows, range.bucketMs).map((r, i) => ({
    id: String(i),
    ts: r.ts,
    data: r.data,
  }));

  res.json(result);
});

// GET /api/telemetry/:deviceId/export?range=24h
router.get("/:deviceId/export", async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.deviceId, tenantId: req.auth!.tenantId },
  });
  if (!device) {
    res.status(404).json({ error: "device tidak ditemukan" });
    return;
  }

  const rangeKey = typeof req.query.range === "string" ? req.query.range : "24h";
  const range = RANGES[rangeKey];
  if (!range) {
    res.status(400).json({
      error: `range harus salah satu dari: ${Object.keys(RANGES).join(", ")}`,
    });
    return;
  }

  const since = new Date(Date.now() - range.ms);

  const rows = await prisma.telemetry.findMany({
    where: { deviceId: device.id, ts: { gte: since } },
    orderBy: { ts: "asc" },
    select: { ts: true, data: true },
    take: 50000,
  });

  if (rows.length === 0) {
    res.status(404).json({ error: "tidak ada data pada rentang waktu ini" });
    return;
  }

  // kumpulkan semua nama metric yang muncul
  const metrics = new Set<string>();
  for (const row of rows) {
    const data = row.data as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number") metrics.add(key);
    }
  }
  const metricList = [...metrics].sort();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pentarium IoT";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Telemetri");

  sheet.columns = [
    { header: "Waktu", key: "waktu", width: 22 },
    ...metricList.map((m) => ({ header: m, key: m, width: 14 })),
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF26B5A5" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const row of rows) {
    const data = row.data as Record<string, unknown>;
    const entry: Record<string, unknown> = {
      waktu: row.ts.toLocaleString("id-ID", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
    };
    for (const m of metricList) {
      entry[m] = typeof data[m] === "number" ? data[m] : null;
    }
    sheet.addRow(entry);
  }

  const namaFile = `telemetri-${device.name.replace(/[^a-zA-Z0-9]/g, "-")}-${rangeKey}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${namaFile}"`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
