-- record_attempts: keep full score precision (was cast to float4).
create or replace function public.record_attempts(batch jsonb) returns int
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
      (a->>'score')::double precision, array(select jsonb_array_elements_text(a->'errors')),
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
