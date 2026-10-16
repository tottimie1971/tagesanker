create table if not exists public.tagesanker_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{"points":0,"tasks":[],"deletedTasks":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tagesanker_state enable row level security;

drop policy if exists "Users can read their own Tagesanker state" on public.tagesanker_state;
create policy "Users can read their own Tagesanker state"
  on public.tagesanker_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own Tagesanker state" on public.tagesanker_state;
create policy "Users can create their own Tagesanker state"
  on public.tagesanker_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Tagesanker state" on public.tagesanker_state;
create policy "Users can update their own Tagesanker state"
  on public.tagesanker_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.tagesanker_state to authenticated;