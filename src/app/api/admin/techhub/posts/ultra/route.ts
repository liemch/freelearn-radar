import { NextResponse } from "next/server";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";

export async function GET() {
  try {
    await requireTechhubAdmin();
    const posts = await getTechhubClient().getUltraPosts();
    return NextResponse.json({ posts, count: posts.length });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không quét được bài Ultra",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
