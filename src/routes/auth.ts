import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = Router();

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

  // bikin tenant + user admin sekaligus
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      users: { create: { email, passwordHash, role: "admin" } },
    },
    include: { users: true },
  });

  const user = tenant.users[0];
  res.status(201).json({
    message: "registrasi berhasil",
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

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  res.json({ message: "login berhasil", token });
});

export default router;