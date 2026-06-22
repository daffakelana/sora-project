import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client untuk Server Components / Server Actions / Route Handlers.
// Di Next.js 16 `cookies()` bersifat async, jadi fungsi ini juga async.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component (read-only cookies). Aman diabaikan
            // karena refresh session ditangani oleh proxy.
          }
        },
      },
    }
  );
}
