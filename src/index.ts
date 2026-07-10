import express from "express";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import deviceRouter from "./routes/device.js";
import telemetryRouter from "./routes/telemetry.js";
import dashboardRouter from "./routes/dashboard.js";
import { startMqtt } from "./mqtt.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/devices", deviceRouter);
app.use("/api/telemetry", telemetryRouter);
app.use("/api/dashboard", dashboardRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API jalan di http://localhost:${port}`);
  startMqtt();
});