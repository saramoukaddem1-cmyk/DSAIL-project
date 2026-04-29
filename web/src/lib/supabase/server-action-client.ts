import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/**
 * Supabase client for Server Actions only: `cookies().set` works here, so the
 * auth session is written on the HTTP response (Set-Cookie). Client-side
 * sign-in only touches `document.cookie` and often does not match what the
 * server reads on the next navigation.
 */
export async function createClientForAuthActions() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        void headers;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // In some Next.js contexts cookies can't be mutated (e.g. during prerender / non-action execution).
          // Middleware should keep sessions fresh; failing to set here should not crash the dev server.
        }
      },
    },
  });
}
