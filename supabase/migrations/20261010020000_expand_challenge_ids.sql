-- Allow the expanded 200-per-track question bank to use ids like rookie-100.

alter table public.challenges
  drop constraint if exists challenges_id_check;

alter table public.challenges
  add constraint challenges_id_check check (id ~ '^(rookie|challenger|strategist)-[0-9]{2,3}$');
