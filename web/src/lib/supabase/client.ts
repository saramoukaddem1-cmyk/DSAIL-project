import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

const cookieOpts = {
  path: "/" as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Single browser client so auth state isn’t split across instances (fixes flaky login).
 * During RSC/SSR, `window` is undefined — we still return a client so accidental render-time
 * calls cannot white-screen the app; only event handlers should rely on this module.
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  if (typeof window === "undefined") {
    return createBrowserClient(url, anonKey, { cookieOptions: cookieOpts });
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey, { cookieOptions: cookieOpts });
  }
  return browserClient;
}
