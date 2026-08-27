import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";

const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9@._-]+$/);

export async function GET(request: Request) {
  try {
    await requireTechhubAdmin();
    const rawUsername = new URL(request.url).searchParams.get("username") ?? "";
    const parsed = usernameSchema.safeParse(rawUsername);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Username không hợp lệ" },
        { status: 400 },
      );
    }

    const username = parsed.data.toLowerCase();
    const posts = await getTechhubClient().getRecentUnpublishedPostsByUsername(
      username,
      20,
    );
    return NextResponse.json({ username, posts, count: posts.length });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không lấy được bài gần nhất của user",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
