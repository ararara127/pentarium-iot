import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// tambahin properti "auth" ke tipe Request bawaan express
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; tenantId: string; role: string };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "token tidak ada" });
    return;
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      tenantId: string;
      role: string;
    };
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "token tidak valid" });
  }
}