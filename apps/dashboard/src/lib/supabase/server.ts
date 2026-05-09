import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client with the user's auth cookie session — for use in Server
 * Components, Route Handlers, and Server Actions. Reads/writes auth cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Calling from a Server Component — ignore; middleware refreshes.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS — only use in trusted server contexts
 * (webhooks, server actions where we've already verified auth).
 */
export function createServiceClient() {
  // Lazy-imported to avoid bundling service-role key into client builds.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
