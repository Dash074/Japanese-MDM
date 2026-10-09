-- RLS + record_attempts verification (implementation.md §7.1 "Security").
-- Creates two throwaway users, checks isolation, then deletes them. Run: npx tsx scripts/db-query.ts supabase/tests/rls.sql
delete from auth.users where email like '%@fude.test';
create temp table _r (k text, v text);
grant all on _r to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@fude.test'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@fude.test');
insert into _r select 'profiles created by trigger', count(*)::text from public.profiles
  where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Act as user A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
insert into _r select 'A: record_attempts inserted (expect 2 of 3, one duplicate)', public.record_attempts('[
  {"client_id":"x1","kanji":"右","mode":"practice","level":"trace","device":"pen","best_match":"左","score":0.8,"errors":["confusion"],"strokes":5,"ms":3000,"hesitation_ms":0,"at":1760000000000},
  {"client_id":"x1","kanji":"右","mode":"practice","level":"trace","device":"pen","best_match":"左","score":0.8,"errors":["confusion"],"strokes":5,"ms":3000,"hesitation_ms":0,"at":1760000000000},
  {"client_id":"x2","kanji":"木","mode":"review","level":"blank","device":"pen","best_match":"木","score":0.9,"errors":["order","position"],"strokes":4,"ms":2500,"hesitation_ms":100,"auto":2,"grade":3,"at":1760000001000}
]'::jsonb)::text;
insert into _r select 'A: resend same batch inserts (expect 0)', public.record_attempts('[{"client_id":"x1","kanji":"右","mode":"practice","level":"trace","device":"pen","best_match":"左","score":0.8,"errors":["confusion"],"strokes":5,"ms":3000,"hesitation_ms":0,"at":1760000000000}]'::jsonb)::text;
insert into public.cards (user_id, kanji, guide_level) values ('11111111-1111-1111-1111-111111111111', '木', 'hint');
insert into _r select 'A: sees own attempts', count(*)::text from public.attempts;
insert into _r select 'A: confusion 右→左 count', coalesce((select count::text from public.confusions where target='右' and written='左'), 'none');
insert into _r select 'A: error_stats rows', count(*)::text from public.error_stats;

-- Act as user B.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
insert into _r select 'B: sees A''s attempts (expect 0)', count(*)::text from public.attempts;
insert into _r select 'B: sees A''s cards (expect 0)', count(*)::text from public.cards;
insert into _r select 'B: sees A''s confusions (expect 0)', count(*)::text from public.confusions;
insert into _r select 'B: sees profiles (expect 1, own)', count(*)::text from public.profiles;
do $$ begin
  insert into public.cards (user_id, kanji) values ('11111111-1111-1111-1111-111111111111', '人');
  insert into _r values ('B: write a card as A', 'ALLOWED (BAD)');
exception when others then insert into _r values ('B: write a card as A', 'blocked (good)');
end $$;

-- Anonymous (signed out).
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
do $$ begin
  perform public.record_attempts('[]'::jsonb);
  insert into _r values ('anon: record_attempts', 'ALLOWED (BAD)');
exception when others then insert into _r values ('anon: record_attempts', 'blocked (good)');
end $$;
reset role;

delete from auth.users where email like '%@fude.test';
insert into _r select 'cleanup: test rows left', (select count(*) from public.attempts where user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'))::text;
select * from _r;
