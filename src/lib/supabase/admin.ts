import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code that has
 * already verified the caller (e.g. the Stripe webhook after signature check).
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY.");
  }
  return createClient(publicEnv.supabaseUrl(), secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
