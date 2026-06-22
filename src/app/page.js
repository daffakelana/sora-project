import { HomeBooks } from "@/components/home-books";
import { createClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/user";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = mapUser(user);

  const { data } = await supabase
    .from("chapters")
    .select("slug, title, subtitle, description, words(count)")
    .order("position", { ascending: true });

  const chapters = (data ?? []).map((chapter) => ({
    // Di UI home: "title" = label bab ("Bab 1"), "subtitle" = nama bab.
    title: chapter.subtitle,
    subtitle: chapter.title,
    description: chapter.description ?? "Belum ada deskripsi.",
    wordCount: chapter.words?.[0]?.count ?? 0,
    // Tiap bab punya halaman kosakatanya sendiri.
    href: `/vocabulary/${chapter.slug}`,
    quizHref: "/practice",
  }));

  return <HomeBooks chapters={chapters} userName={profile?.name} />;
}
