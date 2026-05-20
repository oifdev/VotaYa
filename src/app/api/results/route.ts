import { type NextRequest } from "next/server";

import { ok, serverError } from "@/lib/api-response";
import { emptyResults, getResultsPayload } from "@/lib/elections";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { createPublicDataClient } from "@/lib/supabase/public-data";

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseBrowserEnv()) {
      return ok(emptyResults(), {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const electionId = request.nextUrl.searchParams.get("electionId");
    const supabase = await createPublicDataClient();
    const results = await getResultsPayload(supabase, electionId);

    return ok(results, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
