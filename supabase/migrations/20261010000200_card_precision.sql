-- FSRS stability/difficulty need full precision; float4 drifted on every sync round-trip.
alter table public.cards alter column stability type double precision, alter column difficulty type double precision;
alter table public.attempts alter column score type double precision;
