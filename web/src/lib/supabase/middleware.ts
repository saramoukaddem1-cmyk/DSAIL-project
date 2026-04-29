import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_GET_USER_TIMEOUT_MS } from "@/lib/supabase/timeouts";
import { withTimeout } from "@/lib/with-timeout";

export async function updateSession(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
            for (const [key, value] of Object.entries(headers ?? {})) {
              supabaseResponse.headers.set(key, value);
            }
          },
        },
      },
    );

    try {
      await withTimeout(
        supabase.auth.getUser(),
        SUPABASE_GET_USER_TIMEOUT_MS,
        "supabase.auth.getUser",
      );
    } catch {
      // Timeout, network, or DNS — still return response so pages can load.
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] updateSession failed:", e);
    return NextResponse.next({ request });
  }
}
