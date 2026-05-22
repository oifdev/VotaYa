import { requireAdminApi } from "@/lib/auth";
import { ok, serverError } from "@/lib/api-response";

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return serverError(error);

  return ok({ logs: data ?? [] });
}
