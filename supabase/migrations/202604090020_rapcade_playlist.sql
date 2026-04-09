-- RAPCADE playlist schema for project: lgmfxylcqscjtndjpirf
-- Project URL: https://lgmfxylcqscjtndjpirf.supabase.co
--
-- Before using the generated public URLs below:
-- 1. Create a public Storage bucket named `rapcade-media` in the Supabase dashboard.
-- 2. Upload the audio files and cover art into that bucket using the paths listed here.
--
-- Note:
-- Pure SQL in Supabase/Postgres cannot inspect an uploaded audio file and discover its runtime.
-- This migration keeps `duration_seconds` as the source of truth and auto-generates `duration_label`
-- so the app always gets a Winamp-style `m:ss` value from the database.

create or replace function public.seconds_to_clock(total_seconds integer)
returns text
language sql
immutable
as $$
  select (greatest(total_seconds, 0) / 60)::text || ':' || lpad((greatest(total_seconds, 0) % 60)::text, 2, '0');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.playlist_tracks (
  id bigint generated always as identity primary key,
  position integer not null unique,
  title text not null,
  artist text not null default 'IAM NASTY NASH',
  format_label text not null,
  audio_bucket text not null default 'rapcade-media',
  audio_path text not null unique,
  cover_bucket text not null default 'rapcade-media',
  cover_path text,
  duration_seconds integer not null check (duration_seconds > 0),
  duration_label text generated always as (public.seconds_to_clock(duration_seconds)) stored,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists playlist_tracks_set_updated_at on public.playlist_tracks;
create trigger playlist_tracks_set_updated_at
before update on public.playlist_tracks
for each row
execute function public.set_updated_at();

alter table public.playlist_tracks enable row level security;

drop policy if exists "playlist tracks are public read" on public.playlist_tracks;
create policy "playlist tracks are public read"
on public.playlist_tracks
for select
using (is_published = true);

create or replace view public.rapcade_playlist_public as
select
  id,
  position,
  title,
  artist,
  format_label,
  duration_seconds,
  duration_label,
  audio_bucket,
  audio_path,
  cover_bucket,
  cover_path,
  'https://lgmfxylcqscjtndjpirf.supabase.co/storage/v1/object/public/' || audio_bucket || '/' || audio_path as audio_url,
  case
    when cover_path is null then null
    else 'https://lgmfxylcqscjtndjpirf.supabase.co/storage/v1/object/public/' || cover_bucket || '/' || cover_path
  end as cover_url
from public.playlist_tracks
where is_published = true
order by position;

insert into public.playlist_tracks (
  position,
  title,
  artist,
  format_label,
  audio_path,
  cover_path,
  duration_seconds
)
values
  (1,  'QUIEN DIJO', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/1-quien-dijo.wav', 'covers/qdqnsp-cover.png', 213),
  (2,  'OVERTHINKING', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/2-overthinking.wav', 'covers/qdqnsp-cover.png', 106),
  (3,  'VIEWS FT FRANK ROSSO', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/3-views-ft-frank-rosso.wav', 'covers/qdqnsp-cover.png', 178),
  (4,  'LIMON', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/4-limon.wav', 'covers/qdqnsp-cover.png', 167),
  (5,  'I WONDER', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/5-i-wonder.wav', 'covers/qdqnsp-cover.png', 192),
  (6,  'LA CULPA', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/6-la-culpa.wav', 'covers/qdqnsp-cover.png', 164),
  (7,  'MILLONARIO', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/7-millonario.wav', 'covers/qdqnsp-cover.png', 112),
  (8,  'I HAD TO', 'IAM NASTY NASH', 'WAV • Album Cut', 'album/8-i-had-to.wav', 'covers/qdqnsp-cover.png', 213),
  (9,  'QUIEN DIJO KE NO SE PUEDE [TRAP REMIX]', 'IAM NASTY NASH', 'MP3 • 64 kbps • 44.1 kHz • stereo', 'remixes/quien-dijo-trap-remix.mp3', 'covers/quien-dijo-trap-remix-cover.png', 240),
  (10, 'PA LOKO [REMIX]', 'IAM NASTY NASH', 'WAV • 16-bit • 48 kHz • stereo', 'remixes/pa-loko-remix.wav', 'covers/pa-loko-cover.png', 138)
on conflict (position) do update
set
  title = excluded.title,
  artist = excluded.artist,
  format_label = excluded.format_label,
  audio_path = excluded.audio_path,
  cover_path = excluded.cover_path,
  duration_seconds = excluded.duration_seconds,
  is_published = true;
