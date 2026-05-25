import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};