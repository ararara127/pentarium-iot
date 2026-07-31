/**
 * Kirim email uji Resend.
 * Jalankan: npx tsx src/scripts/send-test-email.ts
 */
import "dotenv/config";
import { sendEmail } from "../email.js";

const to = process.env.ALERT_TO_EMAIL ?? "azzahraindah127@gmail.com";

const result = await sendEmail({
  to,
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});

console.log("Email terkirim:", result);
