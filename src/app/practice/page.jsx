import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function PracticePage() {
  const supabase = await createClient();

  const { data: question } = await supabase
    .from("quiz_questions")
    .select("prompt, options")
    .limit(1)
    .maybeSingle();

  const prompt = question?.prompt ?? "Apa arti dari kata lernen?";
  const options = question?.options ?? ["berlari", "belajar", "membaca", "menulis"];

  return (
    <main className="min-h-svh bg-background px-6 pb-32 pt-16">
      <section className="mx-auto max-w-4xl rounded-[2rem] border bg-card p-8 shadow-xl shadow-primary/10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Latihan
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Kuis cepat</h1>
        <p className="mt-4 text-muted-foreground">{prompt}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {options.map((answer) => (
            <Button
              key={answer}
              variant="outline"
              className="h-auto justify-start px-5 py-4 text-left"
              type="button"
            >
              {answer}
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}
