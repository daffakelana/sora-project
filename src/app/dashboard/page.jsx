import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .rpc("get_dashboard_stats", { p_user_id: user?.id })
    .single();

  const stats = [
    ["Kosakata aktif", `${data?.active_words ?? 0} kata`],
    ["Latihan selesai", `${data?.finished_sessions ?? 0} sesi`],
    ["Akurasi minggu ini", `${data?.weekly_accuracy ?? 0}%`],
  ];

  return (
    <main className="min-h-svh px-6 pb-32 pt-16">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">
          Ringkasan belajar kamu
        </h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {stats.map(([label, value]) => (
            <article
              key={label}
              className="rounded-[2rem] border bg-card p-6 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
