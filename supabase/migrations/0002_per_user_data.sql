-- ============================================================
--  Jadikan konten kursus (bab/kata/contoh) milik per-akun.
--  Jalankan di Supabase SQL Editor.
-- ============================================================

-- 1. Hapus konten bawaan — semua akun mulai dari kosong.
--    Cascade otomatis menghapus words, word_examples, quiz_questions.
delete from public.chapters;

-- 2. Tambah kolom kepemilikan.
alter table public.chapters
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;
alter table public.words
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

-- Tabel sudah kosong, jadi aman dijadikan wajib.
alter table public.chapters alter column owner_id set not null;
alter table public.words    alter column owner_id set not null;

-- 3. Slug unik PER pemilik (bukan global) supaya tiap akun bisa punya "bab-1".
alter table public.chapters drop constraint if exists chapters_slug_key;
alter table public.chapters
  add constraint chapters_owner_slug_key unique (owner_id, slug);

create index if not exists chapters_owner_idx on public.chapters (owner_id);
create index if not exists words_owner_idx on public.words (owner_id);

-- ============================================================
--  4. RLS: ganti policy "boleh dibaca semua" jadi per-pemilik.
-- ============================================================

-- chapters
drop policy if exists "read chapters" on public.chapters;
drop policy if exists "insert chapters" on public.chapters;
create policy "own chapters" on public.chapters
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- words
drop policy if exists "read words" on public.words;
drop policy if exists "insert own words" on public.words;
drop policy if exists "delete words" on public.words;
create policy "own words" on public.words
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- word_examples (ikut kepemilikan word induk)
drop policy if exists "read examples" on public.word_examples;
drop policy if exists "insert examples" on public.word_examples;
create policy "own examples" on public.word_examples
  for all to authenticated
  using (
    exists (
      select 1 from public.words w
      where w.id = word_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.words w
      where w.id = word_id and w.owner_id = auth.uid()
    )
  );

-- quiz_questions (ikut kepemilikan chapter induk)
drop policy if exists "read quiz" on public.quiz_questions;
create policy "own quiz" on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.chapters c
      where c.id = chapter_id and c.owner_id = auth.uid()
    )
  );
