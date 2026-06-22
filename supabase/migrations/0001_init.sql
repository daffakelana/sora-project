-- ============================================================
--  German Vocab App — Supabase schema
--  Jalankan di Supabase SQL Editor (atau via `supabase db push`).
-- ============================================================

-- ----- Extensions -----
create extension if not exists "pgcrypto";   -- untuk gen_random_uuid()

-- ============================================================
--  1. PROFILES  (1 baris per user, terhubung ke auth.users)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
--  2. CHAPTERS  (Bab — mis. "Bab 1: Dasar Sehari-hari")
-- ============================================================
create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- "bab-1"
  title       text not null,                 -- "Dasar Sehari-hari"
  subtitle    text,                          -- "Bab 1"
  description text,
  position    int  not null default 0,       -- urutan tampil
  created_at  timestamptz not null default now()
);

-- ============================================================
--  3. WORDS  (Kosakata)
-- ============================================================
create table if not exists public.words (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid references public.chapters (id) on delete cascade,
  article             text,                  -- "der" | "die" | "das" | "" (null untuk kata kerja/sifat)
  type                text not null,         -- "Kata benda" | "Kata sifat" | "Kata kerja"
  german              text not null,         -- "das Haus"
  indonesian          text not null,         -- "rumah"
  pronunciation       text,                  -- dari API pencarian (opsional)
  source_url          text,                  -- sumber Wiktionary (opsional)
  -- kalimat unggulan (sentence) di-flatten jadi kolom:
  sentence_before     text,
  sentence_highlight  text,
  sentence_after      text,
  sentence_translation text,
  position            int not null default 0,
  created_by          uuid references auth.users (id) on delete set null,  -- null = kata bawaan
  created_at          timestamptz not null default now(),
  unique (chapter_id, german)
);

create index if not exists words_chapter_idx on public.words (chapter_id, position);

-- ============================================================
--  4. WORD_EXAMPLES  (Contoh kalimat per kata, termasuk AI generated)
-- ============================================================
create table if not exists public.word_examples (
  id           uuid primary key default gen_random_uuid(),
  word_id      uuid not null references public.words (id) on delete cascade,
  german       text not null,
  indonesian   text not null,
  is_generated boolean not null default false,  -- true = hasil "Generate with AI"
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists word_examples_word_idx on public.word_examples (word_id, position);

-- ============================================================
--  5. QUIZZES & QUESTIONS  (halaman Latihan / Kuis)
-- ============================================================
create table if not exists public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  chapter_id     uuid references public.chapters (id) on delete cascade,
  word_id        uuid references public.words (id) on delete set null,
  prompt         text not null,            -- "Apa arti dari kata lernen?"
  options        text[] not null,          -- {'berlari','belajar','membaca','menulis'}
  correct_index  int  not null,            -- index jawaban benar di options
  created_at     timestamptz not null default now()
);

-- ============================================================
--  6. PRACTICE_SESSIONS  (riwayat latihan user -> "Latihan selesai" & akurasi)
-- ============================================================
create table if not exists public.practice_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  chapter_id     uuid references public.chapters (id) on delete set null,
  total_questions int not null default 0,
  correct_count   int not null default 0,
  completed_at    timestamptz not null default now()
);

create index if not exists practice_user_idx on public.practice_sessions (user_id, completed_at);

-- ============================================================
--  7. USER_WORD_STATUS  (kata yang dipelajari user -> "Kosakata aktif")
-- ============================================================
create table if not exists public.user_word_status (
  user_id     uuid not null references auth.users (id) on delete cascade,
  word_id     uuid not null references public.words (id) on delete cascade,
  status      text not null default 'learning',  -- 'learning' | 'mastered'
  updated_at  timestamptz not null default now(),
  primary key (user_id, word_id)
);

-- ============================================================
--  8. USER_DAILY_PROGRESS  (halaman Progress -> persen per hari)
-- ============================================================
create table if not exists public.user_daily_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  percentage int  not null check (percentage between 0 and 100),
  primary key (user_id, day)
);

-- ============================================================
--  9. TRIGGERS
-- ============================================================

-- 9a. updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- 9b. Auto-buat profile saat user mendaftar (signup)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  10. FUNCTION: ringkasan Dashboard untuk 1 user
--      (mengganti angka hardcoded "128 kata / 36 sesi / 82%")
-- ============================================================
create or replace function public.get_dashboard_stats(p_user_id uuid)
returns table (
  active_words      bigint,
  finished_sessions bigint,
  weekly_accuracy   int
)
language sql stable as $$
  select
    (select count(*) from public.user_word_status w where w.user_id = p_user_id),
    (select count(*) from public.practice_sessions s where s.user_id = p_user_id),
    coalesce((
      select round(100.0 * sum(correct_count) / nullif(sum(total_questions), 0))
      from public.practice_sessions s
      where s.user_id = p_user_id
        and s.completed_at >= now() - interval '7 days'
    ), 0)::int;
$$;

-- ============================================================
--  11. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.chapters            enable row level security;
alter table public.words               enable row level security;
alter table public.word_examples       enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.practice_sessions   enable row level security;
alter table public.user_word_status    enable row level security;
alter table public.user_daily_progress enable row level security;

-- Konten kursus (chapters/words/examples/quiz) -> boleh dibaca semua user login
create policy "read chapters"  on public.chapters       for select to authenticated using (true);
create policy "read words"     on public.words          for select to authenticated using (true);
create policy "read examples"  on public.word_examples  for select to authenticated using (true);
create policy "read quiz"      on public.quiz_questions  for select to authenticated using (true);

-- User boleh menambah kata/contoh sendiri (fitur "Tambah kata" & "Generate with AI")
create policy "insert own words" on public.words
  for insert to authenticated with check (created_by = auth.uid());
create policy "insert examples" on public.word_examples
  for insert to authenticated with check (true);

-- User boleh menambah bab baru (fitur "Tambah bagian" di home)
create policy "insert chapters" on public.chapters
  for insert to authenticated with check (true);

-- User boleh menghapus kata (fitur "Hapus" di tabel kosakata).
-- word_examples ikut terhapus otomatis (ON DELETE CASCADE).
create policy "delete words" on public.words
  for delete to authenticated using (true);

-- Profile: hanya milik sendiri
create policy "own profile select" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Data per-user: hanya milik sendiri (select/insert/update/delete)
create policy "own sessions" on public.practice_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own word status" on public.user_word_status
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own progress" on public.user_daily_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
--  12. SEED DATA  (kata-kata bawaan dari src/app/vocabulary/bab-1)
-- ============================================================
insert into public.chapters (slug, title, subtitle, description, position)
values ('bab-1', 'Dasar Sehari-hari', 'Bab 1',
        'Daftar kosakata seperti kamus.', 1)
on conflict (slug) do nothing;

-- Sisipkan kata + kalimat unggulan + contoh dalam satu blok per kata.
do $$
declare
  v_chapter uuid;
  v_word    uuid;
begin
  select id into v_chapter from public.chapters where slug = 'bab-1';

  -- helper inline: tiap kata diinsert lalu contohnya
  -- 1. das Haus
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'das', 'Kata benda', 'das Haus', 'rumah',
    'Das ', 'Haus', ' ist gross.', 'Rumah itu besar.', 1)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Das Haus ist gross.', 'Rumah itu besar.', 1),
      (v_word, 'Ich wohne in einem Haus.', 'Saya tinggal di sebuah rumah.', 2);
  end if;

  -- 2. schoen
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, '', 'Kata sifat', 'schoen', 'indah',
    'Der Garten ist sehr ', 'schoen', '.', 'Taman itu sangat indah.', 2)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Der Garten ist sehr schoen.', 'Taman itu sangat indah.', 1),
      (v_word, 'Das Bild ist schoen.', 'Gambar itu indah.', 2);
  end if;

  -- 3. die Stadt
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'die', 'Kata benda', 'die Stadt', 'kota',
    'Die ', 'Stadt', ' ist alt.', 'Kota itu tua.', 3)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Die Stadt ist alt.', 'Kota itu tua.', 1),
      (v_word, 'Ich gehe in die Stadt.', 'Saya pergi ke kota.', 2);
  end if;

  -- 4. die Liebe
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'die', 'Kata benda', 'die Liebe', 'cinta',
    'Die ', 'Liebe', ' ist wichtig.', 'Cinta itu penting.', 4)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Die Liebe ist wichtig.', 'Cinta itu penting.', 1),
      (v_word, 'Liebe macht das Leben schoen.', 'Cinta membuat hidup indah.', 2);
  end if;

  -- 5. das Wasser
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'das', 'Kata benda', 'das Wasser', 'air',
    'Das ', 'Wasser', ' ist kalt.', 'Air itu dingin.', 5)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Das Wasser ist kalt.', 'Air itu dingin.', 1),
      (v_word, 'Ich trinke Wasser.', 'Saya minum air.', 2);
  end if;

  -- 6. gluecklich
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, '', 'Kata sifat', 'gluecklich', 'bahagia',
    'Ich bin ', 'gluecklich', '.', 'Saya bahagia.', 6)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Ich bin gluecklich.', 'Saya bahagia.', 1),
      (v_word, 'Sie ist heute gluecklich.', 'Dia bahagia hari ini.', 2);
  end if;

  -- 7. der Hund
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'der', 'Kata benda', 'der Hund', 'anjing',
    'Der ', 'Hund', ' spielt.', 'Anjing itu bermain.', 7)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Der Hund spielt.', 'Anjing itu bermain.', 1),
      (v_word, 'Der Hund ist klein.', 'Anjing itu kecil.', 2);
  end if;

  -- 8. die Zeit
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'die', 'Kata benda', 'die Zeit', 'waktu',
    'Die ', 'Zeit', ' vergeht schnell.', 'Waktu berlalu cepat.', 8)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Die Zeit vergeht schnell.', 'Waktu berlalu cepat.', 1),
      (v_word, 'Ich habe keine Zeit.', 'Saya tidak punya waktu.', 2);
  end if;

  -- 9. der Tag
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'der', 'Kata benda', 'der Tag', 'hari',
    'Der ', 'Tag', ' beginnt.', 'Hari dimulai.', 9)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Der Tag beginnt.', 'Hari dimulai.', 1),
      (v_word, 'Heute ist ein guter Tag.', 'Hari ini adalah hari yang baik.', 2);
  end if;

  -- 10. lernen
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, '', 'Kata kerja', 'lernen', 'belajar',
    'Wir ', 'lernen', ' Deutsch.', 'Kami belajar bahasa Jerman.', 10)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Wir lernen Deutsch.', 'Kami belajar bahasa Jerman.', 1),
      (v_word, 'Ich lerne jeden Tag.', 'Saya belajar setiap hari.', 2);
  end if;

  -- 11. die Frage
  insert into public.words (chapter_id, article, type, german, indonesian,
    sentence_before, sentence_highlight, sentence_after, sentence_translation, position)
  values (v_chapter, 'die', 'Kata benda', 'die Frage', 'pertanyaan',
    'Die ', 'Frage', ' ist einfach.', 'Pertanyaan itu mudah.', 11)
  on conflict (chapter_id, german) do nothing returning id into v_word;
  if v_word is not null then
    insert into public.word_examples (word_id, german, indonesian, position) values
      (v_word, 'Die Frage ist einfach.', 'Pertanyaan itu mudah.', 1),
      (v_word, 'Ich habe eine Frage.', 'Saya punya pertanyaan.', 2);
  end if;
end $$;

-- Seed kuis Latihan (dari src/app/practice/page.jsx)
insert into public.quiz_questions (chapter_id, word_id, prompt, options, correct_index)
select c.id, w.id,
       'Apa arti dari kata lernen?',
       array['berlari','belajar','membaca','menulis'],
       1
from public.chapters c
left join public.words w on w.chapter_id = c.id and w.german = 'lernen'
where c.slug = 'bab-1'
on conflict do nothing;
