import express from "express";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import deviceRouter from "./routes/device.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/devices", deviceRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API jalan di http://localhost:${port}`);
});