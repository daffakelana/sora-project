"use server";

import { createClient } from "@/lib/supabase/server";

// Simpan kata baru (dari fitur "Tambah kata") + contoh kalimatnya ke Supabase.
// Mengembalikan { error } bila gagal; { ok: true } bila sukses.
export async function addWord(chapterSlug, word) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Harus login untuk menambah kata." };
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("slug", chapterSlug)
    .single();

  if (chapterError || !chapter) {
    return { error: "Bab tidak ditemukan." };
  }

  const { data: inserted, error: wordError } = await supabase
    .from("words")
    .insert({
      chapter_id: chapter.id,
      article: word.article ?? "",
      type: word.type ?? "Kosakata",
      german: word.german,
      indonesian: word.indonesian,
      pronunciation: word.pronunciation ?? null,
      source_url: word.sourceUrl ?? null,
      sentence_before: word.sentence?.before ?? "",
      sentence_highlight: word.sentence?.highlight ?? word.german,
      sentence_after: word.sentence?.after ?? "",
      sentence_translation: word.sentence?.translation ?? word.indonesian,
      created_by: user.id,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (wordError) {
    // Kemungkinan kata sudah ada (unique chapter_id + german).
    return { error: wordError.message };
  }

  const examples = (word.examples ?? []).map(([german, indonesian], index) => ({
    word_id: inserted.id,
    german,
    indonesian,
    is_generated: false,
    position: index + 1,
  }));

  if (examples.length > 0) {
    await supabase.from("word_examples").insert(examples);
  }

  return { ok: true };
}

// Hapus kata berdasarkan bab + teks Jerman (unik per bab).
// word_examples ikut terhapus otomatis lewat ON DELETE CASCADE.
export async function deleteWord(chapterSlug, german) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Harus login untuk menghapus kata." };
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("slug", chapterSlug)
    .single();

  if (chapterError || !chapter) {
    return { error: "Bab tidak ditemukan." };
  }

  const { error } = await supabase
    .from("words")
    .delete()
    .eq("chapter_id", chapter.id)
    .eq("german", german);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}
