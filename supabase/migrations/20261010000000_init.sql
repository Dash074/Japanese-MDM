-- Fude initial schema (implementation.md §4.9). Every table is protected by Row-Level Security.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- FSRS state + guide level per (user, kanji)
create table public.cards (
  user_id uuid not null references auth.users on delete cascade,
  kanji text not null,
  guide_level text not null default 'trace' check (guide_level in ('trace','hint','blank','recall')),
  due timestamptz not null default now(),
  stability real not null default 0,
  difficulty real not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, kanji)
);

-- Every analysed attempt (research data, FR-14). client_id makes uploads idempotent.
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  kanji text not null,
  mode text not null check (mode in ('practice','review','drill')),
  guide_level text not null,
  device text not null,
  best_match text not null,
  score real not null,
  errors text[] not null default '{}',
  stroke_count int not null,
  duration_ms int not null,
  hesitation_ms int not null,
  auto_rating smallint,
  final_rating smallint,
  client_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index attempts_user_time on public.attempts (user_id, client_created_at desc);

create table public.confusions (
  user_id uuid not null references auth.users on delete cascade,
  target text not null,
  written text not null,
  count int not null default 1,
  last_seen timestamptz not null default now(),
  primary key (user_id, target, written)
);

create table public.error_stats (
  user_id uuid not null references auth.users on delete cascade,
  kanji text not null,
  error_type text not null,
  count int not null default 0,
  last_seen timestamptz,
  primary key (user_id, kanji, error_type)
);

alter table public.profiles    enable row level security;
alter table public.cards       enable row level security;
alter table public.attempts    enable row level security;
alter table public.confusions  enable row level security;
alter table public.error_stats enable row level security;

create policy "own profile" on public.profiles    for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own rows"    on public.cards       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows"    on public.attempts    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows"    on public.confusions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows"    on public.error_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profile row on sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Record a batch of attempts and update aggregate counters atomically.
-- Idempotent: re-sent attempts (same client_id) are ignored.
create function public.record_attempts(batch jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  a jsonb;
  inserted int := 0;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  for a in select * from jsonb_array_elements(batch) loop
    insert into public.attempts (client_id, user_id, kanji, mode, guide_level, device, best_match, score, errors,
      stroke_count, duration_ms, hesitation_ms, auto_rating, final_rating, client_created_at)
    values (a->>'client_id', uid, a->>'kanji', a->>'mode', a->>'level', a->>'device', a->>'best_match',
      (a->>'score')::real, array(select jsonb_array_elements_text(a->'errors')),
      (a->>'strokes')::int, (a->>'ms')::int, (a->>'hesitation_ms')::int,
      (a->>'auto')::smallint, (a->>'grade')::smallint, to_timestamp((a->>'at')::bigint / 1000.0))
    on conflict (user_id, client_id) do nothing;
    if not found then continue; end if;
    inserted := inserted + 1;

    insert into public.error_stats (user_id, kanji, error_type, count, last_seen)
    select uid, a->>'kanji', e, 1, now() from jsonb_array_elements_text(a->'errors') e
    on conflict (user_id, kanji, error_type) do update set count = error_stats.count + 1, last_seen = now();

    if a->>'best_match' <> a->>'kanji' then
      insert into public.confusions (user_id, target, written) values (uid, a->>'kanji', a->>'best_match')
      on conflict (user_id, target, written) do update set count = confusions.count + 1, last_seen = now();
    end if;
  end loop;
  return inserted;
end $$;
