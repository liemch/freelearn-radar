import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";

type RouteContext = {
  params: Promise<{ techhubId: string }>;
};

function parseTechhubId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.trunc(value);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireTechhubAdmin();
    const { techhubId: rawId } = await context.params;
    const techhubId = parseTechhubId(rawId);
    if (techhubId === null) {
      return NextResponse.json({ error: "techhub_id không hợp lệ" }, { status: 400 });
    }

    const client = getTechhubClient();
    const post = await client.getPostByTechhubId(techhubId);
    if (!post) {
      return NextResponse.json({ error: `Không tìm thấy bài ${techhubId}` }, { status: 404 });
    }

    const interactions = await client.getInteractionsByTechhubId(techhubId);
    return NextResponse.json({ post, interactionCount: interactions.length });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không tải được bài viết" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  is_ultra: z.boolean(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireTechhubAdmin();
    const { techhubId: rawId } = await context.params;
    const techhubId = parseTechhubId(rawId);
    if (techhubId === null) {
      return NextResponse.json({ error: "techhub_id không hợp lệ" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const client = getTechhubClient();
    const updated = await client.updatePostFlags(techhubId, {
      is_ultra: parsed.data.is_ultra,
    });
    if (!updated) {
      return NextResponse.json(
        { error: `Không cập nhật được bài ${techhubId}` },
        { status: 404 },
      );
    }

    return NextResponse.json({ post: updated });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không cập nhật được bài viết" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
