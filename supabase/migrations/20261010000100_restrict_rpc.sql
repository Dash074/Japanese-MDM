-- Defence in depth: only signed-in users may call record_attempts (it also checks auth.uid()).
revoke execute on function public.record_attempts(jsonb) from public, anon;
grant execute on function public.record_attempts(jsonb) to authenticated;
