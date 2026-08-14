import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { findUserByEmail } from "@/db/repositories/user-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, unauthorizedResponse } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`login:${clientKey(request)}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000) || 60) },
      },
    );
  }

  try {
    const body = loginSchema.parse(await request.json());
    const db = getDb();
    const user = await findUserByEmail(db, body.email);

    if (!user) {
      return unauthorizedResponse("Invalid email or password");
    }

    const validPassword = await verifyPassword(body.password, user.passwordHash);

    if (!validPassword) {
      return unauthorizedResponse("Invalid email or password");
    }

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: user.id,
      action: "ADMIN_LOGIN",
      entityType: "user",
      entityId: user.id,
      after: { role: user.role },
    });

    logger.info("admin.auth.login", {
      userId: user.id,
      role: user.role,
      status: "success",
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
      logger.error("admin.auth.login", {
        status: "error",
        error: "AUTH_SECRET misconfigured",
      });
      return NextResponse.json(
        { error: "Authentication is not configured" },
        { status: 500 },
      );
    }

    logger.error("admin.auth.login", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
