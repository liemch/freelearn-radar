import { NextResponse } from "next/server";

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

export async function DELETE(_request: Request, context: RouteContext) {
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

    const before = await client.getInteractionsByTechhubId(techhubId);
    if (before.length === 0) {
      return NextResponse.json({
        ok: true,
        deleted: 0,
        remaining: 0,
        message: `Bài ${techhubId} không có interactions`,
      });
    }

    const deleted = await client.deleteInteractionsByTechhubId(techhubId);
    const remaining = await client.getInteractionsByTechhubId(techhubId);

    return NextResponse.json({
      ok: true,
      deleted: deleted.length,
      remaining: remaining.length,
    });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không xóa được interactions" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
