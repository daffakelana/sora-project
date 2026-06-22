import { notFound } from "next/navigation";

import { ChapterVocabulary } from "@/components/chapter-vocabulary";
import { createClient } from "@/lib/supabase/server";

// Ubah baris Supabase (word + word_examples) ke bentuk yang dipakai komponen UI.
function mapWord(row) {
  const examples = (row.word_examples ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((example) => [example.german, example.indonesian]);

  return {
    article: row.article ?? "",
    type: row.type,
    german: row.german,
    indonesian: row.indonesian,
    pronunciation: row.pronunciation ?? "",
    sourceUrl: row.source_url ?? "",
    sentence: {
      before: row.sentence_before ?? "",
      highlight: row.sentence_highlight ?? row.german,
      after: row.sentence_after ?? "",
      translation: row.sentence_translation ?? row.indonesian,
    },
    examples: examples.length > 0 ? examples : [[row.german, row.indonesian]],
  };
}

export default async function ChapterVocabularyPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("slug, title, subtitle, words(*, word_examples(*))")
    .eq("slug", slug)
    .single();

  if (!chapter) {
    notFound();
  }

  const words = (chapter.words ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(mapWord);

  const chapterMeta = {
    slug: chapter.slug,
    title: chapter.title,
    subtitle: chapter.subtitle ?? "",
  };

  return <ChapterVocabulary chapter={chapterMeta} initialWords={words} />;
}
