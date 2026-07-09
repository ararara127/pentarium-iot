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

      console.log(`Data tersimpan dari ${device.name}:`, data);
    } catch (err) {
      console.error("Error proses pesan MQTT:", err);
    }
  });

  client.on("error", (err) => {
    console.error("MQTT error:", err.message);
  });
}