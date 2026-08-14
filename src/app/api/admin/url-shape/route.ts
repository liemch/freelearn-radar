import { NextResponse } from "next/server";
import { z } from "zod";

import { classifyUrlShape } from "@/domain/discovery/url-shape-classifier";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";

const bodySchema = z.object({
  url: z.string().min(1).max(2000),
});

/** Small utility for the provider URL try-box (M19.0c). */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    assertEditor(session);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    return NextResponse.json({
      classification: classifyUrlShape(parsed.data.url),
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Classification failed" }, { status: 400 });
  }
}
