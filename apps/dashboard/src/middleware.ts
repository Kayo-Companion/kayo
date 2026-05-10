import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes Supabase auth tokens on every request that needs them.
 *
 * Without this middleware, the buyer's Supabase access token (a JWT) expires
 * after ~1 hour and every subsequent visit forces a fresh phone-OTP login —
 * even though the long-lived refresh token in the same cookie jar is still
 * valid.
 *
 * On every matched request, we read the cookie jar, ask Supabase who's
 * logged in (getUser), and let the SSR client write back rotated cookies
 * onto the response. The browser then has a fresh access token good for
 * another hour, indefinitely, as long as the user keeps visiting.
 *
 * The `matcher` skips static assets + image files so we don't burn extra
 * Supabase requests on every PNG load.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: do not put any code between createServerClient() and
  // getUser() — that's the call that triggers the token refresh + cookie
  // rotation.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - image files served from /public
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
