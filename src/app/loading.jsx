import { Loader2 } from "lucide-react";

// Muncul instan saat pindah halaman selagi data server diambil (Suspense).
export default function Loading() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm">Memuat…</p>
    </div>
  );
}
