"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { addWord, deleteWord } from "@/app/actions/vocabulary";
import { generateExample, alignWords } from "@/app/actions/ai";

// Palet warna untuk pencocokan kata (group -> warna).
const ALIGN_COLORS = [
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

// Satu baris kalimat: tiap kata berpasangan bisa diklik untuk menyorot
// pasangannya (di kedua bahasa). `activeGroup` = group yang sedang disorot.
function AlignedLine({ tokens, activeGroup, onToggle }) {
  return (
    <span className="leading-8">
      {tokens.map((token, index) => {
        if (!token.group) {
          return (
            <span key={index} className="mr-1 text-muted-foreground">
              {token.text}
            </span>
          );
        }
        const color = ALIGN_COLORS[(token.group - 1) % ALIGN_COLORS.length];
        const isActive = activeGroup === token.group;
        const dimmed = activeGroup !== null && !isActive;
        return (
          <button
            type="button"
            key={index}
            onClick={() => onToggle(token.group)}
            className="mr-1 cursor-pointer rounded px-1 font-medium transition"
            style={{
              backgroundColor: isActive ? color : `${color}22`,
              color: isActive ? "#ffffff" : color,
              opacity: dimmed ? 0.35 : 1,
            }}
          >
            {token.text}
          </button>
        );
      })}
    </span>
  );
}

// Pasangan baris Jerman + Indonesia yang berbagi sorotan klik.
function AlignedPair({ aligned }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const toggle = (group) =>
    setActiveGroup((current) => (current === group ? null : group));

  return (
    <>
      <p className="font-medium">
        <AlignedLine
          tokens={aligned.german}
          activeGroup={activeGroup}
          onToggle={toggle}
        />
      </p>
      <p className="mt-1 text-sm">
        <AlignedLine
          tokens={aligned.indonesian}
          activeGroup={activeGroup}
          onToggle={toggle}
        />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Ketuk sebuah kata untuk menyorot pasangannya.
      </p>
    </>
  );
}

function getIndonesianTranslation(senses) {
  for (const sense of senses) {
    const translation = sense.translations?.find((item) =>
      ["id", "ind"].includes(item.language?.code)
    );

    if (translation?.word) {
      return translation.word;
    }
  }

  return "";
}

function getSenseExamples(senses) {
  return senses
    .flatMap((sense) => sense.examples || [])
    .filter(Boolean)
    .slice(0, 2)
    .map((example) => [example, ""]);
}

// Terjemahkan teks via MyMemory (gratis, tanpa API key). langpair mis. "de|id".
async function translate(text, langpair) {
  if (!text) {
    return "";
  }

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=${langpair}`
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText ?? "";
    // MyMemory kadang membalas pesan kuota/error di translatedText.
    if (
      !translated ||
      /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(translated)
    ) {
      return "";
    }
    return translated;
  } catch {
    return "";
  }
}

async function translateToIndonesian(text) {
  return translate(text, "de|id");
}

// Saran kata Jerman yang diawali huruf yang diketik (Wiktionary opensearch).
async function fetchGermanPrefix(query) {
  try {
    const response = await fetch(
      `https://de.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        query
      )}&limit=6&namespace=0&format=json&origin=*`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

// Bangun rekomendasi dua section sekaligus (karena ejaan bisa mirip):
// - section "Jerman": kata Jerman yang ejaannya mirip + artinya (Indonesia)
// - section "Indonesia": query dianggap kata Indonesia -> kata Jerman yang artinya sama
// Tiap item punya `word` (yang ditampilkan), `meaning` (arti), dan
// `germanToAdd` (kata Jerman yang benar-benar disimpan saat ditambahkan).
async function buildSuggestions(query) {
  const [germanWords, indoToGerman] = await Promise.all([
    fetchGermanPrefix(query),
    translate(query, "id|de"),
  ]);

  const topGerman = germanWords.slice(0, 5);
  const meanings = await Promise.all(
    topGerman.map((word) => translateToIndonesian(word))
  );

  const germanSection = topGerman.map((word, index) => ({
    section: "german",
    word,
    meaning: meanings[index] || "",
    germanToAdd: word,
  }));

  const indoSection = [];
  if (indoToGerman && indoToGerman.toLowerCase() !== query.toLowerCase()) {
    indoSection.push({
      section: "indo",
      word: query,
      meaning: indoToGerman,
      germanToAdd: indoToGerman,
    });
  }

  return { germanSection, indoSection };
}

function mapApiResultToWord(result) {
  const entry = result.entries?.find((item) => item.language?.code === "de");
  const senses = entry?.senses || [];
  const examples = getSenseExamples(senses);

  return {
    article: "",
    type: entry?.partOfSpeech || "Kosakata",
    german: result.word,
    // Arti dari kamus kalau ada terjemahan Indonesia; kalau tidak, diisi
    // lewat translateToIndonesian() di handleSearch.
    indonesian: getIndonesianTranslation(senses) || "",
    sentence: {
      before: "",
      highlight: result.word,
      after: "",
      translation: "",
    },
    examples:
      examples.length > 0
        ? examples
        : [[`${result.word} ist ein deutsches Wort.`, ""]],
    pronunciation: entry?.pronunciations?.[0]?.text || "",
    sourceUrl: result.source?.url || "https://freedictionaryapi.com",
  };
}

// Lengkapi arti & terjemahan contoh ke bahasa Indonesia.
async function fillIndonesian(word) {
  const indonesian =
    word.indonesian || (await translateToIndonesian(word.german)) || "Arti belum tersedia.";

  const examples = await Promise.all(
    word.examples.map(async ([german, existing]) => [
      german,
      existing || (await translateToIndonesian(german)) || "Terjemahan belum tersedia.",
    ])
  );

  return {
    ...word,
    indonesian,
    sentence: { ...word.sentence, translation: indonesian },
    examples,
  };
}

function getHighlightTerms(word) {
  return word.german
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function HighlightedSentence({ sentence, word }) {
  const terms = getHighlightTerms(word);

  if (terms.length === 0) {
    return sentence;
  }

  const pattern = new RegExp(`(${terms.join("|")})`, "gi");

  return sentence.split(pattern).map((part, index) => {
    const isHighlighted = terms.some(
      (term) => part.toLowerCase() === term.replace(/\\/g, "").toLowerCase()
    );

    if (!isHighlighted) {
      return part;
    }

    return (
      <mark
        key={`${part}-${index}`}
        className="rounded-sm bg-primary/15 px-1 text-primary"
      >
        {part}
      </mark>
    );
  });
}

function speakGerman(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const germanVoice = voices.find((voice) => voice.lang.startsWith("de"));

  utterance.lang = "de-DE";
  utterance.rate = 0.85;

  if (germanVoice) {
    utterance.voice = germanVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function SuggestionRow({ item, status, onAdd }) {
  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <p className="min-w-0 truncate">
          <span className="font-medium">{item.word}</span>
          {item.meaning ? (
            <span className="text-muted-foreground"> — {item.meaning}</span>
          ) : (
            <span className="text-muted-foreground"> — …</span>
          )}
        </p>
        {status === "done" ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <Check className="size-3.5" />
            Berhasil ditambahkan
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={status === "loading"}
            onClick={() => onAdd(item)}
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Menambahkan…
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Tambah
              </>
            )}
          </Button>
        )}
      </div>
    </li>
  );
}

export function ChapterVocabulary({ chapter, initialWords }) {
  const [words, setWords] = useState(initialWords);
  const [selectedWord, setSelectedWord] = useState(null);
  const [generatedExamples, setGeneratedExamples] = useState({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState({
    germanSection: [],
    indoSection: [],
  });
  const [suggestStatus, setSuggestStatus] = useState("idle");
  // Status tombol "Tambah" per kata: { [german]: "loading" | "done" | "error" }
  const [addStatus, setAddStatus] = useState({});
  const [wordToDelete, setWordToDelete] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [deleteError, setDeleteError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [isAddingSearch, setIsAddingSearch] = useState(false);
  const [alignments, setAlignments] = useState({});
  const [aligningKey, setAligningKey] = useState("");

  function alignKeyOf(example) {
    return `${example.german}|||${example.indonesian}`;
  }

  async function handleAlign(example) {
    const key = alignKeyOf(example);
    if (alignments[key] || aligningKey) {
      return;
    }
    setAligningKey(key);
    const result = await alignWords(example.german, example.indonesian);
    setAligningKey("");
    if (result?.error || !result?.german) {
      setGenerateError(result?.error || "Gagal mencocokkan kata.");
      return;
    }
    setAlignments((current) => ({ ...current, [key]: result }));
  }

  // Rekomendasi langsung muncul saat mengetik (debounce 400ms), tanpa klik Cari.
  useEffect(() => {
    const query = searchTerm.trim();

    if (query.length < 2) {
      setSuggestions({ germanSection: [], indoSection: [] });
      setSuggestStatus("idle");
      return;
    }

    let active = true;
    setSuggestStatus("loading");
    const timer = setTimeout(async () => {
      const result = await buildSuggestions(query);
      if (active) {
        setSuggestions(result);
        setAddStatus({});
        setSuggestStatus("idle");
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const selectedGeneratedExamples = selectedWord
    ? generatedExamples[selectedWord.german] || []
    : [];
  const selectedExamples = selectedWord
    ? [
        ...selectedWord.examples.map(([german, indonesian]) => ({
          german,
          indonesian,
          generated: false,
        })),
        ...selectedGeneratedExamples,
      ]
    : [];

  async function handleGenerateMore() {
    if (!selectedWord || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setGenerateError("");

    // Kumpulkan kalimat yang sudah ada agar AI tidak mengulang.
    const existingGerman = [
      ...selectedWord.examples.map(([german]) => german),
      ...(generatedExamples[selectedWord.german] || []).map(
        (example) => example.german
      ),
    ];

    const result = await generateExample(
      {
        german: selectedWord.german,
        indonesian: selectedWord.indonesian,
        type: selectedWord.type,
      },
      existingGerman
    );

    setIsGenerating(false);

    if (result?.error || !result?.german) {
      setGenerateError(result?.error || "Gagal membuat contoh.");
      return;
    }

    setGeneratedExamples((currentExamples) => {
      const currentWordExamples = currentExamples[selectedWord.german] || [];
      return {
        ...currentExamples,
        [selectedWord.german]: [
          ...currentWordExamples,
          {
            german: result.german,
            indonesian: result.indonesian,
            generated: true,
          },
        ],
      };
    });
  }

  async function lookupWord(rawQuery) {
    const query = rawQuery.trim();
    if (!query) {
      return;
    }

    setSuggestions({ germanSection: [], indoSection: [] });
    setSearchStatus("loading");
    setSearchError("");
    setSearchResult(null);

    try {
      const response = await fetch(
        `https://freedictionaryapi.com/api/v1/entries/de/${encodeURIComponent(
          query
        )}?translations=true`
      );

      if (!response.ok) {
        throw new Error("Kosakata tidak ditemukan.");
      }

      const result = await response.json();
      const nextWord = await fillIndonesian(mapApiResultToWord(result));

      setSearchResult(nextWord);
      setSearchStatus("success");
    } catch (error) {
      setSearchError(error.message || "Gagal mencari kosakata.");
      setSearchStatus("error");
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    lookupWord(searchTerm);
  }

  // Tambah langsung dari baris rekomendasi: ambil detail lengkap lalu simpan.
  async function handleAddSuggestion(item) {
    const key = item.germanToAdd;
    setAddStatus((current) => ({ ...current, [key]: "loading" }));

    if (words.some((word) => word.german.toLowerCase() === key.toLowerCase())) {
      setAddStatus((current) => ({ ...current, [key]: "done" }));
      return;
    }

    // Arti yang sudah diketahui dari rekomendasi (untuk fallback).
    const knownIndonesian = item.section === "indo" ? item.word : item.meaning;

    let wordObj = null;
    try {
      const response = await fetch(
        `https://freedictionaryapi.com/api/v1/entries/de/${encodeURIComponent(
          key
        )}?translations=true`
      );
      if (response.ok) {
        wordObj = await fillIndonesian(mapApiResultToWord(await response.json()));
      }
    } catch {
      // diabaikan, pakai fallback di bawah
    }

    if (!wordObj) {
      const indonesian = knownIndonesian || "Arti belum tersedia.";
      wordObj = {
        article: "",
        type: "Kosakata",
        german: key,
        indonesian,
        sentence: { before: "", highlight: key, after: "", translation: indonesian },
        examples: [],
        pronunciation: "",
        sourceUrl: "https://freedictionaryapi.com",
      };
    }

    setWords((current) => [...current, wordObj]);

    const saved = await addWord(chapter.slug, wordObj);
    if (saved?.error) {
      setAddStatus((current) => ({ ...current, [key]: "error" }));
      setSearchError(`Gagal menyimpan: ${saved.error}`);
      return;
    }

    setAddStatus((current) => ({ ...current, [key]: "done" }));
  }

  function openDeleteConfirm(word) {
    setWordToDelete(word);
    setDeleteStatus("idle");
    setDeleteError("");
  }

  function closeDeleteConfirm() {
    setWordToDelete(null);
    setDeleteStatus("idle");
    setDeleteError("");
  }

  async function handleConfirmDelete() {
    if (!wordToDelete) {
      return;
    }

    setDeleteStatus("loading");
    setDeleteError("");

    const result = await deleteWord(chapter.slug, wordToDelete.german);

    if (result?.error) {
      setDeleteStatus("error");
      setDeleteError(result.error);
      return;
    }

    setWords((current) =>
      current.filter((word) => word.german !== wordToDelete.german)
    );
    setDeleteStatus("done");
  }

  async function handleAddSearchResult() {
    if (!searchResult || isAddingSearch) {
      return;
    }

    const alreadyExists = words.some(
      (word) => word.german.toLowerCase() === searchResult.german.toLowerCase()
    );

    if (!alreadyExists) {
      setIsAddingSearch(true);
      setWords((currentWords) => [...currentWords, searchResult]);
      // Simpan ke Supabase.
      const result = await addWord(chapter.slug, searchResult);
      setIsAddingSearch(false);
      if (result?.error) {
        setSearchError(`Gagal menyimpan: ${result.error}`);
      }
    }

    setSelectedWord(searchResult);
    setIsSearchOpen(false);
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 sm:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {chapter.subtitle}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {chapter.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Daftar kosakata seperti kamus. Klik tombol pelafalan untuk
              mendengar cara baca bahasa Jerman.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="w-fit"
              onClick={() => setIsSearchOpen(true)}
            >
              <Plus className="size-4" />
              Tambah kata
            </Button>
            <Button asChild variant="outline" className="w-fit">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Kembali
              </Link>
            </Button>
          </div>
        </div>

        {words.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-8" />
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Belum ada kosakata
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Bab ini masih kosong. Yuk tambah kosakata pertamamu sekarang!
            </p>
            <Button
              type="button"
              className="mt-6"
              onClick={() => setIsSearchOpen(true)}
            >
              <Plus className="size-4" />
              Tambah kata sekarang
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="hidden grid-cols-[1.2fr_1fr_10rem_9rem] border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
              <span>Jerman</span>
              <span>Arti</span>
              <span>Pelafalan</span>
              <span>Detail</span>
            </div>

            <div className="divide-y">
              {words.map((word) => (
              <div
                key={word.german}
                className="grid gap-4 px-5 py-4 transition hover:bg-muted/40 sm:grid-cols-[1.2fr_1fr_10rem_9rem] sm:items-center"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                    Jerman
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight sm:mt-0">
                    {word.german}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {word.article ? `${word.article} - ${word.type}` : word.type}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                    Arti
                  </p>
                  <p className="mt-1 text-sm text-foreground sm:mt-0">
                    {word.indonesian}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                    Pelafalan
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => speakGerman(word.german)}
                  >
                    <Volume2 className="size-4" />
                    Dengar
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                    Detail
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWord(word);
                        setGenerateError("");
                      }}
                    >
                      Detail
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteConfirm(word)}
                      aria-label={`Hapus ${word.german}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div
        className={
          selectedWord
            ? "pointer-events-auto fixed inset-0 z-50"
            : "pointer-events-none fixed inset-0 z-50"
        }
        aria-hidden={!selectedWord}
      >
        <button
          type="button"
          className={
            selectedWord
              ? "absolute inset-0 bg-black/30 opacity-100 transition"
              : "absolute inset-0 bg-black/30 opacity-0 transition"
          }
          onClick={() => setSelectedWord(null)}
          aria-label="Tutup detail"
        />

        <div
          className={
            selectedWord
              ? "absolute inset-x-4 top-1/2 mx-auto max-h-[85svh] max-w-2xl -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-5 opacity-100 shadow-2xl transition sm:p-6"
              : "absolute inset-x-4 top-1/2 mx-auto max-h-[85svh] max-w-2xl -translate-y-[45%] overflow-y-auto rounded-2xl border bg-background p-5 opacity-0 shadow-2xl transition sm:p-6"
          }
          role="dialog"
          aria-modal="true"
          aria-label="Detail kosakata"
        >
          {selectedWord ? (
            <>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Detail kosakata
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {selectedWord.german}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedWord.indonesian} · {selectedWord.type}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedWord(null)}
                  aria-label="Tutup detail"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {selectedExamples.map((example, index) => {
                  const aligned = alignments[alignKeyOf(example)];
                  const isAligning = aligningKey === alignKeyOf(example);

                  return (
                  <div
                    key={`${example.german}-${index}`}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {example.generated ? (
                          <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Sparkles className="size-3.5" />
                            AI generated
                          </p>
                        ) : null}
                        {aligned ? (
                          <AlignedPair aligned={aligned} />
                        ) : (
                          <>
                            <p className="font-medium leading-6">
                              <HighlightedSentence
                                sentence={example.german}
                                word={selectedWord}
                              />
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {example.indonesian}
                            </p>
                          </>
                        )}

                        {!aligned ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => handleAlign(example)}
                            disabled={isAligning}
                          >
                            {isAligning ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Mencocokkan…
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3.5" />
                                Cocokkan kata
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => speakGerman(example.german)}
                        aria-label="Dengar contoh kalimat"
                      >
                        <Volume2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}

                {isGenerating ? (
                  <div className="relative overflow-hidden rounded-xl border bg-card p-4">
                    <div className="pointer-events-none absolute inset-0 gemini-gradient opacity-10" />
                    <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="size-3.5 animate-pulse text-[#9b72cb]" />
                      <span className="gemini-text">AI sedang membuat contoh…</span>
                    </p>
                    <div className="space-y-2">
                      <div className="h-3 w-4/5 rounded-full gemini-gradient opacity-80" />
                      <div className="h-3 w-3/5 rounded-full gemini-gradient opacity-60" />
                    </div>
                  </div>
                ) : null}
              </div>

              {generateError ? (
                <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {generateError}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={handleGenerateMore}
                disabled={isGenerating}
                className={
                  isGenerating
                    ? "gemini-gradient mt-5 w-full border-transparent text-white"
                    : "mt-5 w-full"
                }
              >
                <Sparkles
                  className={isGenerating ? "size-4 animate-pulse" : "size-4"}
                />
                {isGenerating ? "Membuat contoh…" : "Generate more with AI"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div
        className={
          isSearchOpen
            ? "pointer-events-auto fixed inset-0 z-50"
            : "pointer-events-none fixed inset-0 z-50"
        }
        aria-hidden={!isSearchOpen}
      >
        <button
          type="button"
          className={
            isSearchOpen
              ? "absolute inset-0 bg-black/30 opacity-100 transition"
              : "absolute inset-0 bg-black/30 opacity-0 transition"
          }
          onClick={() => setIsSearchOpen(false)}
          aria-label="Tutup cari kosakata"
        />

        <div
          className={
            isSearchOpen
              ? "absolute inset-x-4 top-1/2 mx-auto max-h-[85svh] max-w-xl -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-5 opacity-100 shadow-2xl transition sm:p-6"
              : "absolute inset-x-4 top-1/2 mx-auto max-h-[85svh] max-w-xl -translate-y-[45%] overflow-y-auto rounded-2xl border bg-background p-5 opacity-0 shadow-2xl transition sm:p-6"
          }
          role="dialog"
          aria-modal="true"
          aria-label="Cari kosa kata"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Tambah kata
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Cari kosa kata
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ketik bahasa Jerman atau Indonesia — rekomendasi muncul otomatis.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Tutup cari kosakata"
            >
              <X className="size-4" />
            </Button>
          </div>

          <form className="flex gap-2" onSubmit={handleSearch}>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Contoh: Brot, laufen, atau rumah"
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" disabled={searchStatus === "loading"}>
              <Search className="size-4" />
              {searchStatus === "loading" ? "Mencari" : "Cari"}
            </Button>
          </form>

          {suggestions.germanSection.length > 0 ||
          suggestions.indoSection.length > 0 ? (
            <div className="mt-3 space-y-4">
              {suggestions.germanSection.length > 0 ? (
                <div>
                  <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Jerman (ejaan mirip)
                  </p>
                  <ul className="overflow-hidden rounded-xl border bg-card">
                    {suggestions.germanSection.map((item) => (
                      <SuggestionRow
                        key={`de-${item.germanToAdd}`}
                        item={item}
                        status={addStatus[item.germanToAdd]}
                        onAdd={handleAddSuggestion}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {suggestions.indoSection.length > 0 ? (
                <div>
                  <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Indonesia (arti ke Jerman)
                  </p>
                  <ul className="overflow-hidden rounded-xl border bg-card">
                    {suggestions.indoSection.map((item) => (
                      <SuggestionRow
                        key={`id-${item.germanToAdd}`}
                        item={item}
                        status={addStatus[item.germanToAdd]}
                        onAdd={handleAddSuggestion}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : suggestStatus === "loading" && searchTerm.trim().length >= 2 ? (
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Mencari rekomendasi…
            </p>
          ) : null}

          {searchError ? (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {searchError}
            </p>
          ) : null}

          {searchResult ? (
            <div className="mt-5 rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {searchResult.german}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchResult.type}
                    {searchResult.pronunciation
                      ? ` · ${searchResult.pronunciation}`
                      : ""}
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    {searchResult.indonesian}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => speakGerman(searchResult.german)}
                  aria-label="Dengar pelafalan hasil pencarian"
                >
                  <Volume2 className="size-4" />
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleAddSearchResult}
                  disabled={isAddingSearch}
                >
                  {isAddingSearch ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {isAddingSearch ? "Menyimpan…" : "Tambahkan"}
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={searchResult.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sumber Wiktionary
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Data disediakan oleh{" "}
            <a
              href="https://freedictionaryapi.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              FreeDictionaryAPI.com
            </a>{" "}
            berbasis Wiktionary.
          </p>
        </div>
      </div>

      <div
        className={
          wordToDelete
            ? "pointer-events-auto fixed inset-0 z-50"
            : "pointer-events-none fixed inset-0 z-50"
        }
        aria-hidden={!wordToDelete}
      >
        <button
          type="button"
          className={
            wordToDelete
              ? "absolute inset-0 bg-black/30 opacity-100 transition"
              : "absolute inset-0 bg-black/30 opacity-0 transition"
          }
          onClick={closeDeleteConfirm}
          aria-label="Tutup konfirmasi hapus"
        />

        <div
          className={
            wordToDelete
              ? "absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-2xl border bg-background p-6 opacity-100 shadow-2xl transition"
              : "absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-[45%] rounded-2xl border bg-background p-6 opacity-0 shadow-2xl transition"
          }
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus kosakata"
        >
          {wordToDelete ? (
            deleteStatus === "done" ? (
              <div className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  Berhasil dihapus
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  &quot;{wordToDelete.german}&quot; telah dihapus dari kosakata.
                </p>
                <Button
                  type="button"
                  className="mt-5 w-full"
                  onClick={closeDeleteConfirm}
                >
                  Tutup
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight">
                  Hapus kosakata?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Kata <span className="font-medium text-foreground">{wordToDelete.german}</span>{" "}
                  ({wordToDelete.indonesian}) akan dihapus permanen beserta contoh
                  kalimatnya. Tindakan ini tidak bisa dibatalkan.
                </p>

                {deleteError ? (
                  <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Gagal menghapus: {deleteError}
                  </p>
                ) : null}

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDeleteConfirm}
                    disabled={deleteStatus === "loading"}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteStatus === "loading"}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    <Trash2 className="size-4" />
                    {deleteStatus === "loading" ? "Menghapus…" : "Hapus"}
                  </Button>
                </div>
              </>
            )
          ) : null}
        </div>
      </div>
    </main>
  );
}
