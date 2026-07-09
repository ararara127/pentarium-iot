import crypto from "crypto";

// kode klaim pendek, misal "PTR-8F3A2C"
export function generateClaimCode(): string {
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PTR-${random}`;
}

// token device panjang & acak
export function generateDeviceToken(): string {
  return crypto.randomBytes(24).toString("hex");
}