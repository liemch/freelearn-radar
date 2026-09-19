import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";

const createSchema = z.object({
  count: z.number().int().min(1).max(20),
});

export async function POST(request: Request) {
  try {
    await requireTechhubAdmin();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Nhập số lượng từ 1 đến 20 bài" },
        { status: 400 },
      );
    }

    const posts = await getTechhubClient().createCsocTestPosts(parsed.data.count);
    return NextResponse.json({ posts, created: posts.length }, { status: 201 });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không tạo được bài thử" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
