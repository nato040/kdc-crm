import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 * Bypasses RLS. Used ONLY in server-side API routes for:
 *   - Vault function calls (set_klaviyo_key, get_klaviyo_key)
 *   - Upserts into campaigns/flows tables during sync
 *   - Sync run logging
 *
 * NEVER import this from client components.
 * NEVER expose the service role key in responses or logs.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
