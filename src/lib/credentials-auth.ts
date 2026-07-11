import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const FINE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const IP_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export async function authorizeCredentials(raw: unknown, ip: string) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const email = parsed.data.email.toLowerCase();
  const fineKey = `login:${ip}:${email}`;
  const ipKey = `login-ip:${ip}`;

  // Check limits before touching the DB or bcrypt — bcrypt's cost is the DoS vector.
  const ipCheck = checkRateLimit(ipKey, IP_LIMIT);
  if (!ipCheck.allowed) return null;

  const fineCheck = checkRateLimit(fineKey, FINE_LIMIT);
  if (!fineCheck.allowed) return null;

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) return null;

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return null;

  resetRateLimit(fineKey);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}
