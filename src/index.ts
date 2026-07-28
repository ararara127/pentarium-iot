import express from "express";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import deviceRouter from "./routes/device.js";
import telemetryRouter from "./routes/telemetry.js";
import dashboardRouter from "./routes/dashboard.js";
import { startMqtt } from "./mqtt.js";
import cors from "cors";
import alertRouter from "./routes/alert.js";
import widgetRouter from "./routes/widget.js";

for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} belum di-set di .env`);
    process.exit(1);
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/widgets", widgetRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/devices", deviceRouter);
app.use("/api/telemetry", telemetryRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/alerts", alertRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API jalan di http://localhost:${port}`);
  startMqtt();
});
