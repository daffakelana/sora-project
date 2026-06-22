import { createClient } from "@/lib/supabase/server";

function weekdayLabel(dayString) {
  // dayString berformat "YYYY-MM-DD".
  const date = new Date(`${dayString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dayString;
  }
  const label = date.toLocaleDateString("id-ID", { weekday: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function ProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("user_daily_progress")
    .select("day, percentage")
    .eq("user_id", user?.id ?? "")
    .order("day", { ascending: true })
    .limit(7);

  const progressItems = (data ?? []).map((row) => [
    weekdayLabel(row.day),
    `${row.percentage}%`,
  ]);

  return (
    <main className="min-h-svh bg-muted px-6 pb-32 pt-16">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Progress
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">
          Perkembangan belajar
        </h1>
        <div className="mt-8 space-y-4 rounded-[2rem] border bg-card p-6 shadow-sm">
          {progressItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada data progress. Selesaikan latihan untuk mulai mencatat.
            </p>
          ) : (
            progressItems.map(([day, value]) => (
              <div key={day}>
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span>{day}</span>
                  <span>{value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: value }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
