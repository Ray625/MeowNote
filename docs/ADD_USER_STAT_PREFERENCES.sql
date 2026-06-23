-- Add per-user, per-notebook statistics page preferences.
-- Safe to run more than once after the base MeowNote schema is installed.

create table if not exists public.user_stat_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  category_ids text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, notebook_id)
);

drop trigger if exists set_user_stat_preferences_updated_at
on public.user_stat_preferences;

create trigger set_user_stat_preferences_updated_at
before update on public.user_stat_preferences
for each row execute function public.set_updated_at();

alter table public.user_stat_preferences enable row level security;

grant select, insert, update, delete
on public.user_stat_preferences
to authenticated;

drop policy if exists "Users can read their stat preferences"
on public.user_stat_preferences;
drop policy if exists "Users can insert their stat preferences"
on public.user_stat_preferences;
drop policy if exists "Users can update their stat preferences"
on public.user_stat_preferences;
drop policy if exists "Users can delete their stat preferences"
on public.user_stat_preferences;

create policy "Users can read their stat preferences"
on public.user_stat_preferences for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_notebook_member(notebook_id)
);

create policy "Users can insert their stat preferences"
on public.user_stat_preferences for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_notebook_member(notebook_id)
);

create policy "Users can update their stat preferences"
on public.user_stat_preferences for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_notebook_member(notebook_id)
)
with check (
  user_id = auth.uid()
  and public.is_notebook_member(notebook_id)
);

create policy "Users can delete their stat preferences"
on public.user_stat_preferences for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_notebook_member(notebook_id)
);
