import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";
import { getTechhubClient } from "@/services/techhub/get-client";
import { TECHHUB_ADMIN_SETTING_KEYS } from "@/services/techhub/types";

export async function GET() {
  try {
    await requireTechhubAdmin();
    const client = getTechhubClient();
    const map = await client.getSettings();

    return NextResponse.json({
      settings: {
        enable_auto_reply: map.enable_auto_reply?.value ?? null,
        enable_bulk_comment: map.enable_bulk_comment?.value ?? null,
        max_comments: map.max_comments?.value ?? null,
        target_max_age_days: map.target_max_age_days?.value ?? null,
        max_interactions_per_post:
          map.max_interactions_per_post?.value ?? null,
        push_ultra: map.push_ultra?.value ?? null,
      },
    });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không tải được settings" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  enable_auto_reply: z.boolean(),
  enable_bulk_comment: z.boolean(),
  max_comments: z.number().int().min(1).max(200),
  target_max_age_days: z.number().int().min(1).max(365),
  max_interactions_per_post: z.number().int().min(1).max(100),
  push_ultra: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    await requireTechhubAdmin();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const client = getTechhubClient();
    const {
      enable_auto_reply,
      enable_bulk_comment,
      max_comments,
      target_max_age_days,
      max_interactions_per_post,
      push_ultra,
    } = parsed.data;

    await client.updateSetting("enable_auto_reply", enable_auto_reply, {
      preserveUpdatedAt: true,
    });
    await client.updateSetting("enable_bulk_comment", enable_bulk_comment, {
      preserveUpdatedAt: true,
    });
    await client.updateSetting("max_comments", max_comments, {
      preserveUpdatedAt: true,
    });
    await client.updateSetting("target_max_age_days", target_max_age_days, {
      preserveUpdatedAt: true,
    });
    await client.updateSetting(
      "max_interactions_per_post",
      max_interactions_per_post,
      { preserveUpdatedAt: true },
    );
    await client.updateSetting("push_ultra", push_ultra, {
      preserveUpdatedAt: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lưu được settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
