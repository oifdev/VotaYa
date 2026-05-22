import { requireAdminApi } from "@/lib/auth";
import { ok, serverError } from "@/lib/api-response";
import { NextRequest } from "next/server";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi(request);
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return serverError(error);

  return ok({ logs: data ?? [] });
}
