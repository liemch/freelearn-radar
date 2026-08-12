import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }

    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const response = NextResponse.redirect(new URL("/admin/login", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
