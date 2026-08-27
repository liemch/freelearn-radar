import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";

const patchSchema = z.object({
  techhub_ids: z.array(z.number().int().positive()).min(1).max(20),
  is_ultra: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    await requireTechhubAdmin();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Chọn từ 1 đến 20 bài hợp lệ" },
        { status: 400 },
      );
    }

    const ids = [...new Set(parsed.data.techhub_ids)];
    const posts = await getTechhubClient().updatePostsUltra(
      ids,
      parsed.data.is_ultra,
    );
    return NextResponse.json({ posts, updated: posts.length });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không cập nhật được các bài đã chọn",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
