import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  if (!resend) {
    throw new Error("RESEND_API_KEY belum di-set di .env");
  }

  const from =
    options.from ??
    process.env.ALERT_FROM_EMAIL ??
    "Pentarium IoT <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function sendAlertEmail(message: string) {
  if (process.env.ALERT_EMAIL_ENABLED !== "true") return;

  const to = process.env.ALERT_TO_EMAIL;
  if (!to) {
    console.warn("ALERT_TO_EMAIL belum di-set, skip kirim email alert");
    return;
  }

  await sendEmail({
    to,
    subject: "Pentarium IoT Alert",
    html: `<p><strong>Alert:</strong> ${message}</p>`,
  });
}
