import { eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";
import type { UserRole } from "@/domain/course/types";

export async function findUserByEmail(db: Db, email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(db: Db, input: NewUser): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ ...input, email: input.email.toLowerCase() })
    .returning();

  const user = rows[0];
  if (!user) {
    throw new Error("Failed to create user");
  }

  return user;
}

export async function listUsers(db: Db): Promise<User[]> {
  return db.select().from(users);
}

export async function countUsersByRole(
  db: Db,
  role: UserRole,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, role));

  return rows[0]?.count ?? 0;
}

export async function updateUserRole(
  db: Db,
  id: string,
  role: UserRole,
): Promise<User> {
  const rows = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  const user = rows[0];
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
