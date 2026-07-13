import mqtt from "mqtt";
import { prisma } from "./prisma.js";

const TOPIC = "pentarium/+/telemetry";

export function startMqtt() {
  const client = mqtt.connect(process.env.MQTT_URL as string);

  client.on("connect", () => {
    console.log("MQTT tersambung ke broker");
    client.subscribe(TOPIC, (err) => {
      if (err) console.error("Gagal subscribe:", err.message);
      else console.log(`Subscribe ke topic: ${TOPIC}`);
    });
  });

  client.on("message", async (topic, payload) => {
    try {
      // topic: pentarium/<token>/telemetry  -> ambil bagian tengah
      const token = topic.split("/")[1];

      // 1. validasi: token ini device siapa?
      const device = await prisma.device.findUnique({ where: { token } });
      if (!device) {
        console.warn(`Token device tidak dikenal, pesan diabaikan`);
        return;
      }

      // 2. baca isi pesan (JSON), mis. {"suhu":27.5,"kelembapan":65}
      let data: unknown;
      try {
        data = JSON.parse(payload.toString());
      } catch {
        console.warn(`Payload bukan JSON valid dari device ${device.name}`);
        return;
      }

      // 3. simpan telemetry, dilabeli device & tenant yang benar
      await prisma.telemetry.create({
        data: {
          deviceId: device.id,
          tenantId: device.tenantId,
          data: data as object,
        },
      });

      // 4. update "terakhir terlihat" biar tau device online
      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });

      // 5. cek aturan alert
      await checkAlerts(device.id, device.tenantId, data as Record<string, number>);

      console.log(`Data tersimpan dari ${device.name}:`, data);
    } catch (err) {
      console.error("Error proses pesan MQTT:", err);
    }
  });

  client.on("error", (err) => {
    console.error("MQTT error:", err.message);
  });
}



async function checkAlerts(
  deviceId: string,
  tenantId: string,
  data: Record<string, number>
) {
  const rules = await prisma.alertRule.findMany({
    where: { deviceId, enabled: true },
  });

  for (const rule of rules) {
    const value = data[rule.metric];
    if (typeof value !== "number") continue;

    const breached =
      (rule.operator === ">" && value > rule.threshold) ||
      (rule.operator === "<" && value < rule.threshold);

    if (!breached) continue;

    // anti-spam: jangan bikin alert baru kalau rule ini udah alert < 5 menit lalu
    const recent = await prisma.alert.findFirst({
      where: {
        ruleId: rule.id,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recent) continue;

    const message = `${rule.metric} = ${value} (batas ${rule.operator} ${rule.threshold})`;

    await prisma.alert.create({
      data: { tenantId, deviceId, ruleId: rule.id, message, value },
    });

    // notifikasi: sementara log dulu, nanti diganti email/WhatsApp
    console.warn(`ALERT: ${message}`);
  }
}