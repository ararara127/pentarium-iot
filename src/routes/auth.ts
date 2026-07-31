import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { sendVerificationEmail } from "../notify.js";

const router = Router();

const RESEND_MSG =
  "Jika email terdaftar dan belum diverifikasi, tautan verifikasi telah dikirim.";

function buatVerifyToken() {
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { verifyToken, verifyTokenExpires };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, tenantName } = req.body ?? {};

  if (!email || !password || !tenantName) {
    res.status(400).json({ error: "email, password, tenantName wajib diisi" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "email sudah terdaftar" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { verifyToken, verifyTokenExpires } = buatVerifyToken();

  // bikin tenant + user admin sekaligus (belum terverifikasi)
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      users: {
        create: {
          email,
          passwordHash,
          role: "admin",
          emailVerified: false,
          verifyToken,
          verifyTokenExpires,
        },
      },
    },
    include: { users: true },
  });

  const user = tenant.users[0];

  // gagal kirim email tidak boleh gagalkan registrasi
  await sendVerificationEmail(user.email, verifyToken);

  res.status(201).json({
    message:
      "Registrasi berhasil. Silakan cek email Anda untuk verifikasi sebelum login.",
    tenantId: tenant.id,
    userId: user.id,
    email: user.email,
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email dan password wajib diisi" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "email atau password salah" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "email atau password salah" });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({
      error: "Email belum diverifikasi. Silakan cek inbox Anda.",
      needVerification: true,
    });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  res.json({ message: "login berhasil", token });
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res) => {
  const { token } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token wajib diisi" });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      verifyToken: token,
      verifyTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({
      error: "Token verifikasi tidak valid atau sudah kadaluarsa",
    });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifyToken: null,
      verifyTokenExpires: null,
    },
  });

  res.json({ message: "Email berhasil diverifikasi" });
});

// POST /api/auth/resend-verification
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email wajib diisi" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    const { verifyToken, verifyTokenExpires } = buatVerifyToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyTokenExpires },
    });
    await sendVerificationEmail(user.email, verifyToken);
  }

  // selalu message netral (anti email enumeration)
  res.json({ message: RESEND_MSG });
});

export default router;
