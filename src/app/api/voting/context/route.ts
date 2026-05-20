import { ok, serverError } from "@/lib/api-response";
import { getVotingContext } from "@/lib/elections";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { createPublicDataClient } from "@/lib/supabase/public-data";

export async function GET() {
  try {
    if (!hasSupabaseBrowserEnv()) {
      return ok({ election: null, cargos: [] });
    }

    const supabase = await createPublicDataClient();
    const context = await getVotingContext(supabase);
    return ok(context);
  } catch (error) {
    return serverError(error);
  }
}
