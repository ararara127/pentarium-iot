import { Resend } from "resend";
import { prisma } from "./prisma.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function aktif(): boolean {
  return process.env.ALERT_EMAIL_ENABLED === "true" && resend !== null;
}

function template(deviceName: string, message: string): string {
  const waktu = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#26B5A5;padding:20px 24px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">Peringatan Perangkat</h2>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <p style="margin:0 0 8px;color:#64748b;font-size:13px">Perangkat</p>
        <p style="margin:0 0 20px;font-size:17px;font-weight:bold;color:#0f172a">${deviceName}</p>

        <p style="margin:0 0 8px;color:#64748b;font-size:13px">Kondisi</p>
        <p style="margin:0 0 20px;font-size:15px;color:#dc2626;font-weight:bold">${message}</p>

        <p style="margin:0 0 8px;color:#64748b;font-size:13px">Waktu</p>
        <p style="margin:0 0 24px;font-size:14px;color:#0f172a">${waktu}</p>

        <p style="margin:0;font-size:12px;color:#94a3b8">
          Email ini dikirim otomatis oleh Platform IoT Pentarium karena data perangkat
          melewati batas yang Anda tentukan.
        </p>
      </div>
    </div>
  `;
}

function verificationTemplate(link: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#26B5A5;padding:20px 24px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">Verifikasi Email</h2>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px;font-size:15px;color:#0f172a">
          Halo! Terima kasih sudah mendaftar di <strong>Pentarium IoT</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#475569">
          Silakan verifikasi alamat email Anda dengan menekan tombol di bawah ini.
        </p>
        <p style="margin:0 0 24px;text-align:center">
          <a href="${link}"
             style="display:inline-block;background:#26B5A5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold;font-size:14px">
            Verifikasi Email Saya
          </a>
        </p>
        <p style="margin:0 0 12px;font-size:13px;color:#64748b">
          Atau salin tautan ini ke browser:
        </p>
        <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#26B5A5">${link}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#64748b">
          Tautan ini berlaku selama <strong>24 jam</strong>.
        </p>
        <p style="margin:0;font-size:12px;color:#94a3b8">
          Jika Anda tidak merasa mendaftar, abaikan email ini.
        </p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  try {
    if (!resend) {
      console.warn("RESEND_API_KEY belum di-set, skip email verifikasi");
      return false;
    }

    const baseUrl = process.env.APP_URL ?? "http://localhost:5173";
    const link = `${baseUrl}/verify-email?token=${token}`;

    const { error } = await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL ?? "Pentarium IoT <onboarding@resend.dev>",
      to: email,
      subject: "Verifikasi email akun Pentarium IoT",
      html: verificationTemplate(link),
    });

    if (error) {
      console.error("Gagal kirim email verifikasi:", error.message);
      return false;
    }

    console.log(`Email verifikasi terkirim ke ${email}`);
    return true;
  } catch (err) {
    console.error("Gagal kirim email verifikasi:", err);
    return false;
  }
}

export async function notifyAlert(
  device: { tenantId: string; name: string },
  message: string
): Promise<void> {
  if (!aktif()) return;

  try {
    const users = await prisma.user.findMany({
      where: { tenantId: device.tenantId },
      select: { email: true },
    });

    const tujuan = users.map((u) => u.email);
    if (tujuan.length === 0) return;

    await resend!.emails.send({
      from: process.env.ALERT_FROM_EMAIL ?? "Pentarium IoT <onboarding@resend.dev>",
      to: tujuan,
      subject: `Peringatan: ${device.name}`,
      html: template(device.name, message),
    });

    console.log(`Email alert terkirim ke ${tujuan.join(", ")}`);
  } catch (err) {
    // notifikasi gagal tidak boleh mengganggu penerimaan data
    console.error("Gagal kirim email alert:", err);
  }
}
