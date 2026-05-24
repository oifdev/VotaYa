export const dynamic = 'force-dynamic';
import { requireAdminApi } from "@/lib/auth";
import { ok, serverError } from "@/lib/api-response";
import { getResultsPayload, resultsToDashboardStats } from "@/lib/elections";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const results = await getResultsPayload(admin.supabase);
    return ok({ stats: resultsToDashboardStats(results), results });
  } catch (error) {
    return serverError(error);
  }
}
