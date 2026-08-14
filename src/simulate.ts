import mqtt from "mqtt";
import "dotenv/config";

const DEVICE_TOKEN = "3825b074e2a348e673983175884624a0e4441ddb7a291342";

const client = mqtt.connect(process.env.MQTT_URL as string);
const topicTelemetry = `pentarium/${DEVICE_TOKEN}/telemetry`;
const topicCommand = `pentarium/${DEVICE_TOKEN}/command`;

// "state" perangkat palsu, bisa diubah lewat perintah dari dashboard
let pompaAktif = false;

client.on("connect", () => {
  console.log("Simulator tersambung, mulai kirim data tiap 3 detik...");

  client.subscribe(topicCommand, (err) => {
    if (err) console.error("Gagal subscribe command:", err.message);
    else console.log(`Menunggu perintah di: ${topicCommand}`);
  });

  setInterval(() => {
    const data = {
      suhu: +(25 + Math.random() * 10).toFixed(1),
      kelembapan: +(50 + Math.random() * 30).toFixed(0),
      pompa: pompaAktif ? 1 : 0,
    };
    client.publish(topicTelemetry, JSON.stringify(data));
    console.log("Terkirim:", data);
  }, 3000);
});

client.on("message", (topic, payload) => {
  if (topic !== topicCommand) return;
  try {
    const msg = JSON.parse(payload.toString()) as { command?: string };
    console.log("PERINTAH DITERIMA:", msg);

    if (msg.command === "pompa_on") pompaAktif = true;
    else if (msg.command === "pompa_off") pompaAktif = false;
    else if (msg.command === "toggle_pompa") pompaAktif = !pompaAktif;
    else console.log("Perintah tidak dikenal, diabaikan");

    console.log(`Status pompa sekarang: ${pompaAktif ? "NYALA" : "MATI"}`);
  } catch {
    console.warn("Payload perintah bukan JSON valid");
  }
});

client.on("error", (err) => console.error("Simulator error:", err.message));
