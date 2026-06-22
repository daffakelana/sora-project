"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Tambah bab baru (fitur "Tambah bagian" di home).
export async function addChapter({ subtitle, description }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Harus login untuk menambah bab." };
  }

  const { count } = await supabase
    .from("chapters")
    .select("*", { count: "exact", head: true });

  const position = (count ?? 0) + 1;
  const baseSlug = slugify(subtitle) || `bab-${position}`;

  const { error } = await supabase.from("chapters").insert({
    slug: `${baseSlug}-${position}`,
    title: subtitle,
    subtitle: `Bab ${position}`,
    description: description || "Belum ada deskripsi.",
    position,
    owner_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}
