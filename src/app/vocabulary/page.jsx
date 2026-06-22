import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Arahkan ke bab pertama milik user; kalau belum ada, balik ke home.
export default async function VocabularyPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("chapters")
    .select("slug")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data?.slug) {
    redirect(`/vocabulary/${data.slug}`);
  }

  redirect("/");
}
