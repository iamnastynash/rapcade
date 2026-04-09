create table if not exists public.cash_rain_scores (
  id bigint generated always as identity primary key,
  player_name text not null check (
    char_length(player_name) between 1 and 12
    and player_name = upper(player_name)
    and player_name ~ '^[A-Z0-9 ._-]+$'
  ),
  score integer not null check (score between 1 and 9999),
  created_at timestamptz not null default now()
);

create index if not exists cash_rain_scores_leaderboard_idx
on public.cash_rain_scores (score desc, created_at asc);

alter table public.cash_rain_scores enable row level security;

drop policy if exists "cash rain scores are public read" on public.cash_rain_scores;
create policy "cash rain scores are public read"
on public.cash_rain_scores
for select
using (true);

drop policy if exists "cash rain scores are public insert" on public.cash_rain_scores;
create policy "cash rain scores are public insert"
on public.cash_rain_scores
for insert
with check (
  char_length(player_name) between 1 and 12
  and player_name = upper(player_name)
  and player_name ~ '^[A-Z0-9 ._-]+$'
  and score between 1 and 9999
);

grant select, insert on table public.cash_rain_scores to anon, authenticated;
grant usage, select on sequence public.cash_rain_scores_id_seq to anon, authenticated;

create or replace view public.cash_rain_leaderboard_public as
select
  row_number() over (order by score desc, created_at asc) as rank,
  player_name,
  score,
  created_at as played_at
from public.cash_rain_scores
order by score desc, created_at asc
limit 5;

alter view public.cash_rain_leaderboard_public
set (security_invoker = true);

grant select on table public.cash_rain_leaderboard_public to anon, authenticated;
