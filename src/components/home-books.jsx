"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookOpenText, ImagePlus, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addChapter } from "@/app/actions/chapters";

// Palet warna cover dipasang berdasarkan urutan bab (data warna tidak disimpan di DB).
const stylePalette = [
  { cover: "bg-[#f2c94c]", spine: "bg-[#222222]", accent: "bg-[#f1785b]" },
  { cover: "bg-[#2fb26b]", spine: "bg-[#1d7044]", accent: "bg-[#f6d365]" },
  { cover: "bg-[#f77962]", spine: "bg-[#252a34]", accent: "bg-[#ffd0b8]" },
  { cover: "bg-[#49585a]", spine: "bg-[#2f3b3d]", accent: "bg-[#ff6b6b]" },
  { cover: "bg-[#7fc8a9]", spine: "bg-[#355c4c]", accent: "bg-[#f5d76e]" },
  { cover: "bg-[#88a7e0]", spine: "bg-[#304b78]", accent: "bg-[#f7b267]" },
  { cover: "bg-[#d58bdd]", spine: "bg-[#6f3a76]", accent: "bg-[#f4e06d]" },
];

function BookCover({ chapter }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const wordLabel =
    chapter.wordCount > 0 ? `${chapter.wordCount} kata` : "Belum ada kata";

  function openChapter() {
    startTransition(() => router.push(chapter.href));
  }

  return (
    <article className="mobile-feed-card group flex h-full snap-start snap-always flex-col bg-background p-5 transition duration-300 sm:min-h-[28rem] sm:rounded-3xl sm:bg-card sm:p-5 sm:shadow-sm sm:ring-1 sm:ring-border/40 sm:hover:-translate-y-1 sm:hover:shadow-xl sm:hover:shadow-foreground/5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold leading-tight tracking-tight text-foreground">
          {chapter.subtitle}
        </h2>
        <span className="shrink-0 text-sm text-muted-foreground">
          {chapter.title}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Buka ${chapter.subtitle}`}
          onClick={openChapter}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openChapter();
            }
          }}
          className={cn(
            "mobile-feed-cover relative h-[58svh] max-h-[28rem] w-[68vw] max-w-[18rem] cursor-pointer overflow-hidden rounded-l-md rounded-r-2xl shadow-2xl shadow-foreground/15 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-foreground/25 sm:h-60 sm:w-40",
            chapter.cover
          )}
        >
          {chapter.image ? (
            <img
              src={chapter.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className={cn("absolute inset-y-0 left-0 w-4", chapter.spine)} />
          <div className="absolute inset-x-5 top-7 text-sm font-semibold leading-tight text-black/75">
            <p>{chapter.title}</p>
            <p>{chapter.subtitle}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-[50%] bg-white/35" />
          <div
            className={cn("absolute -bottom-8 left-8 size-24 rounded-full", chapter.accent)}
          />
          <div className="absolute bottom-8 left-10 flex gap-4">
            <span className="size-4 rounded-full bg-white shadow-inner" />
            <span className="size-4 rounded-full bg-white shadow-inner" />
          </div>
          <div className="absolute right-4 top-4 h-1 w-12 rounded-full bg-black/20" />
          <div className="absolute right-4 top-7 h-1 w-8 rounded-full bg-black/20" />
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 transition duration-700 group-hover:translate-x-full group-hover:opacity-100" />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
          <div className="absolute inset-x-4 bottom-4 flex translate-y-4 flex-col gap-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Button asChild variant="outline">
              <Link href={chapter.href} onClick={(event) => event.stopPropagation()}>
                Lihat detail
              </Link>
            </Button>
            <Button asChild>
              <Link href={chapter.quizHref} onClick={(event) => event.stopPropagation()}>
                Quiz
              </Link>
            </Button>
          </div>

          {isPending ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Loader2 className="size-7 animate-spin text-white" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm leading-tight text-muted-foreground">
            <BookOpenText className="size-4" />
            {wordLabel}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {chapter.description}
          </p>
        </div>
        <Link
          href={chapter.href}
          className="shrink-0 text-sm font-medium text-foreground transition hover:text-primary"
        >
          Buka
        </Link>
      </div>
    </article>
  );
}

function AddChapterPanel({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    setSaving(true);
    setError("");
    const result = await onSubmit({
      subtitle: trimmedTitle,
      description: description.trim(),
    });
    setSaving(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setTitle("");
    setDescription("");
    setImage("");
    onClose();
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setImage("");
      return;
    }

    setImage(URL.createObjectURL(file));
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/30 transition",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-label="Tutup panel tambah bagian"
      />
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-md bg-background p-6 shadow-2xl transition duration-300 sm:p-8",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Bagian baru
            </p>
            <h2 className="font-serif text-2xl font-medium tracking-tight">
              Tambah cover bab
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Judul bagian</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Kata kerja dasar"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Deskripsi bagian</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tulis ringkasan singkat bagian ini."
              className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Upload gambar</span>
            <div className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/50 p-4 text-center transition hover:bg-muted">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-32 w-full rounded-xl object-cover"
                />
              ) : (
                <>
                  <ImagePlus className="size-7 text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">
                    Pilih gambar cover
                  </span>
                </>
              )}
              <Input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleImageChange}
              />
            </div>
          </label>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan bagian"}
          </Button>
        </form>
      </aside>
    </div>
  );
}

export function HomeBooks({ chapters, userName }) {
  const router = useRouter();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const styledChapters = chapters.map((chapter, index) => ({
    ...chapter,
    ...stylePalette[index % stylePalette.length],
  }));

  async function handleAddChapter(values) {
    const result = await addChapter(values);
    if (!result?.error) {
      router.refresh();
    }
    return result;
  }

  return (
    <main className="h-[calc(100svh-73px)] overflow-hidden bg-background sm:h-auto sm:min-h-svh sm:overflow-visible sm:px-8 sm:pb-16 sm:pt-10">
      <section className="h-full sm:mx-auto sm:h-auto sm:max-w-6xl">
        <div className="mb-8 hidden flex-col gap-2 sm:flex sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h1 className="font-serif text-4xl font-medium leading-none tracking-tight text-foreground sm:text-5xl">
              Selamat datang, {userName || "Sahabat"}!
            </h1>
            <p className="mt-1 max-w-lg text-base leading-7 text-muted-foreground">
              Never stop chasing ur dream!
            </p>
          </div>
          <Button
            type="button"
            className="w-fit"
            onClick={() => setIsPanelOpen(true)}
          >
            <Plus className="size-4" />
            Tambah bagian
          </Button>
        </div>

        <div className="mobile-feed h-full snap-y snap-mandatory overflow-y-auto overscroll-contain sm:grid sm:h-auto sm:grid-cols-2 sm:gap-2 sm:overflow-visible lg:grid-cols-4">
          {styledChapters.map((chapter) => (
            <BookCover key={chapter.href + chapter.title} chapter={chapter} />
          ))}
        </div>
      </section>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-5 right-5 z-40 sm:hidden"
        onClick={() => setIsPanelOpen(true)}
        aria-label="Tambah bagian"
      >
        <Plus className="size-4" />
      </Button>

      <AddChapterPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSubmit={handleAddChapter}
      />
    </main>
  );
}
