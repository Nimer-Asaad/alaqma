import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Returns the signed-in admin's client, or null when not signed in / not an admin.
 *
 * One round trip: `is_admin()` runs as the caller, so PostgREST first verifies the
 * session JWT (signature + expiry) and `auth.uid()` comes from that verified token.
 * An invalid or missing session therefore can never return true. The proxy has
 * already refreshed the session cookie before this runs. Cached per request.
 */
export const getAdmin = cache(async () => {
  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) return null;
  return { supabase };
});
