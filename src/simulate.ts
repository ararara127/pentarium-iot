import mqtt from "mqtt";
import "dotenv/config";

// GANTI dengan token device lo dari Prisma Studio
const DEVICE_TOKEN = "09d2e45075837e72c791a446d98917486eeafa3f94b4e9e3";

const client = mqtt.connect(process.env.MQTT_URL as string);
const topic = `pentarium/${DEVICE_TOKEN}/telemetry`;

client.on("connect", () => {
  console.log("Simulator tersambung, mulai kirim data tiap 3 detik...");

  setInterval(() => {
    const data = {
      suhu: +(25 + Math.random() * 10).toFixed(1),
      kelembapan: +(50 + Math.random() * 30).toFixed(0),
    };
    client.publish(topic, JSON.stringify(data));
    console.log("Terkirim:", data);
  }, 3000);
});

client.on("error", (err) => console.error("Simulator error:", err.message));