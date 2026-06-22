import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: file ini menggantikan `middleware.js`.
export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  // Jalan di semua route kecuali aset statis & file gambar.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
