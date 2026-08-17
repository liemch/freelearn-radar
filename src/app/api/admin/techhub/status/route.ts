import { NextResponse } from "next/server";

import {
  getTechhubStatusPayload,
  requireTechhubAdmin,
  techhubErrorResponse,
} from "@/app/api/admin/techhub/_lib";

export async function GET() {
  try {
    await requireTechhubAdmin();
    const status = await getTechhubStatusPayload();
    return NextResponse.json(status);
  } catch (error) {
    const handled = techhubErrorResponse(error);
    if (handled) return handled;
    return NextResponse.json({ error: "Không kiểm tra được kết nối" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
