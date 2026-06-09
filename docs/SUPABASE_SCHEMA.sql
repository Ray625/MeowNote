-- MeowNote Supabase schema
-- Paste this into Supabase SQL Editor for the first remote-storage schema.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_members (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (notebook_id, user_id)
);

create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  avatar_id text,
  avatar_url text,
  birthday date,
  sex text check (sex is null or sex in ('male', 'female')),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg >= 0),
  is_neutered boolean,
  note text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, notebook_id)
);

create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  template_id text,
  name text not null check (char_length(trim(name)) > 0),
  group_name text,
  color_id text not null,
  icon text,
  is_default boolean not null default false,
  is_quick_action boolean not null default true,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  statistics_mode text not null default 'count' check (statistics_mode in ('count', 'sum', 'measurement', 'rating')),
  value_label text,
  value_max integer check (value_max is null or value_max >= 2),
  value_unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, notebook_id)
);

alter table public.event_categories
  add column if not exists template_id text,
  add column if not exists statistics_mode text not null default 'count',
  add column if not exists value_label text,
  add column if not exists value_max integer,
  add column if not exists value_unit text;

alter table public.event_categories
  drop constraint if exists event_categories_value_max_check;

alter table public.event_categories
  add constraint event_categories_value_max_check
  check (value_max is null or value_max >= 2);

do $$
begin
  alter table public.event_categories
    drop constraint if exists event_categories_statistics_mode_check;

  alter table public.event_categories
    add constraint event_categories_statistics_mode_check
    check (statistics_mode in ('count', 'sum', 'measurement', 'rating'));
end;
$$;

create table if not exists public.cat_events (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  cat_id uuid not null,
  category_id uuid not null,
  occurred_at timestamptz not null default now(),
  title text,
  severity smallint check (severity is null or severity between 1 and 5),
  note text,
  values jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cat_id, notebook_id) references public.cats(id, notebook_id) on delete cascade,
  foreign key (category_id, notebook_id) references public.event_categories(id, notebook_id) on delete restrict
);

alter table public.cat_events
  add column if not exists photos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-photos',
  'event-photos',
  false,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists idx_notebook_members_user_id
  on public.notebook_members(user_id);

create index if not exists idx_cats_notebook_id
  on public.cats(notebook_id);

create index if not exists idx_event_categories_notebook_id
  on public.event_categories(notebook_id);

create index if not exists idx_cat_events_notebook_occurred_at
  on public.cat_events(notebook_id, occurred_at desc);

create index if not exists idx_cat_events_cat_occurred_at
  on public.cat_events(cat_id, occurred_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_notebooks_updated_at on public.notebooks;
drop trigger if exists set_cats_updated_at on public.cats;
drop trigger if exists set_event_categories_updated_at on public.event_categories;
drop trigger if exists set_cat_events_updated_at on public.cat_events;
drop trigger if exists set_cat_event_created_by on public.cat_events;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_notebooks_updated_at
before update on public.notebooks
for each row execute function public.set_updated_at();

create trigger set_cats_updated_at
before update on public.cats
for each row execute function public.set_updated_at();

create trigger set_event_categories_updated_at
before update on public.event_categories
for each row execute function public.set_updated_at();

create trigger set_cat_events_updated_at
before update on public.cat_events
for each row execute function public.set_updated_at();

create or replace function public.set_cat_event_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  return new;
end;
$$;

create trigger set_cat_event_created_by
before insert on public.cat_events
for each row execute function public.set_cat_event_created_by();

create or replace function public.is_notebook_member(target_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notebook_members
    where notebook_id = target_notebook_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_notebook(target_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notebook_members
    where notebook_id = target_notebook_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.can_create_notebook_event(target_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notebook_members
    where notebook_id = target_notebook_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_notebook_owner(target_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notebook_members
    where notebook_id = target_notebook_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.is_notebook_creator(target_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notebooks
    where id = target_notebook_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.create_notebook(notebook_name text default '我的寵物紀錄')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notebook_id uuid;
  current_user_id uuid := auth.uid();
  normalized_name text := coalesce(nullif(trim(notebook_name), ''), '我的寵物紀錄');
begin
  if current_user_id is null then
    raise exception 'create_notebook requires an authenticated user';
  end if;

  insert into public.notebooks (name, created_by)
  values (normalized_name, current_user_id)
  returning id into new_notebook_id;

  insert into public.notebook_members (notebook_id, user_id, role)
  values (new_notebook_id, current_user_id, 'owner');

  return new_notebook_id;
end;
$$;

grant execute on function public.create_notebook(text) to authenticated;

create or replace function public.share_notebook_with_user(
  target_notebook_id uuid,
  target_email text,
  member_role text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  member_id uuid;
  normalized_email text := lower(trim(target_email));
  normalized_role text := coalesce(nullif(trim(member_role), ''), 'editor');
begin
  if auth.uid() is null then
    raise exception 'share_notebook_with_user requires an authenticated user';
  end if;

  if not public.is_notebook_owner(target_notebook_id) then
    raise exception 'Only notebook owners can share notebooks';
  end if;

  if normalized_email = '' then
    raise exception 'Target email is required';
  end if;

  if normalized_role not in ('editor', 'viewer') then
    raise exception 'Shared member role must be editor or viewer';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'User not found';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot share notebook with yourself';
  end if;

  insert into public.notebook_members (notebook_id, user_id, role)
  values (target_notebook_id, target_user_id, normalized_role)
  on conflict (notebook_id, user_id)
  do update set role = excluded.role
  returning id into member_id;

  return member_id;
end;
$$;

grant execute on function public.share_notebook_with_user(uuid, text, text) to authenticated;

create or replace function public.leave_shared_notebook(target_notebook_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    raise exception 'leave_shared_notebook requires an authenticated user';
  end if;

  select role
  into current_role
  from public.notebook_members
  where notebook_id = target_notebook_id
    and user_id = auth.uid();

  if current_role is null then
    raise exception 'Notebook membership not found';
  end if;

  if current_role = 'owner' then
    raise exception 'Notebook owners cannot leave their own notebook';
  end if;

  delete from public.notebook_members
  where notebook_id = target_notebook_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_shared_notebook(uuid) to authenticated;

create or replace function public.delete_owned_notebook_without_events(target_notebook_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'delete_owned_notebook_without_events requires an authenticated user';
  end if;

  if not public.is_notebook_owner(target_notebook_id) then
    raise exception 'Only notebook owners can delete notebooks';
  end if;

  if exists (
    select 1
    from public.notebook_members
    where notebook_id = target_notebook_id
      and user_id <> auth.uid()
  ) then
    raise exception 'Cannot delete notebooks with shared members';
  end if;

  if exists (
    select 1
    from public.cat_events
    where notebook_id = target_notebook_id
  ) then
    raise exception 'Cannot delete notebooks with records';
  end if;

  delete from public.notebooks
  where id = target_notebook_id;
end;
$$;

grant execute on function public.delete_owned_notebook_without_events(uuid) to authenticated;

create or replace function public.get_event_photo_notebook_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = public, storage
as $$
  select case
    when (storage.foldername(object_name))[1] = 'notebooks'
      and (storage.foldername(object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.can_upload_event_photo_object(
  object_name text,
  object_metadata jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  target_notebook_id uuid := public.get_event_photo_notebook_id(object_name);
  object_size bigint := coalesce((object_metadata->>'size')::bigint, 0);
  notebook_used_bytes bigint;
  recent_upload_count integer;
  notebook_quota_bytes bigint := 200 * 1024 * 1024;
  recent_upload_limit integer := 15;
begin
  if target_notebook_id is null then
    return false;
  end if;

  if not public.can_create_notebook_event(target_notebook_id) then
    return false;
  end if;

  if object_size <= 0 or object_size > 2097152 then
    return false;
  end if;

  select coalesce(sum((metadata->>'size')::bigint), 0)
  into notebook_used_bytes
  from storage.objects
  where bucket_id = 'event-photos'
    and public.get_event_photo_notebook_id(name) = target_notebook_id
    and metadata ? 'size';

  if notebook_used_bytes + object_size > notebook_quota_bytes then
    return false;
  end if;

  select count(*)
  into recent_upload_count
  from storage.objects
  where bucket_id = 'event-photos'
    and owner_id = auth.uid()::text
    and created_at > now() - interval '10 minutes';

  return recent_upload_count < recent_upload_limit;
end;
$$;

alter table public.profiles enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_members enable row level security;
alter table public.cats enable row level security;
alter table public.event_categories enable row level security;
alter table public.cat_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.notebooks to authenticated;
grant select, insert, update, delete on public.notebook_members to authenticated;
grant select, insert, update, delete on public.cats to authenticated;
grant select, insert, update, delete on public.event_categories to authenticated;
grant select, insert, update, delete on public.cat_events to authenticated;

drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Users can insert their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Members can read notebooks" on public.notebooks;
drop policy if exists "Users can create notebooks" on public.notebooks;
drop policy if exists "Owners and editors can update notebooks" on public.notebooks;
drop policy if exists "Owners can update notebooks" on public.notebooks;
drop policy if exists "Members can read notebook members" on public.notebook_members;
drop policy if exists "Users can add themselves as notebook owner" on public.notebook_members;
drop policy if exists "Owners can add notebook members" on public.notebook_members;
drop policy if exists "Owners can update notebook members" on public.notebook_members;
drop policy if exists "Owners can delete notebook members" on public.notebook_members;
drop policy if exists "Members can read cats" on public.cats;
drop policy if exists "Owners and editors can insert cats" on public.cats;
drop policy if exists "Owners and editors can update cats" on public.cats;
drop policy if exists "Owners and editors can delete cats" on public.cats;
drop policy if exists "Owners can insert cats" on public.cats;
drop policy if exists "Owners can update cats" on public.cats;
drop policy if exists "Owners can delete cats" on public.cats;
drop policy if exists "Members can read event categories" on public.event_categories;
drop policy if exists "Owners and editors can insert event categories" on public.event_categories;
drop policy if exists "Owners and editors can update event categories" on public.event_categories;
drop policy if exists "Owners and editors can delete event categories" on public.event_categories;
drop policy if exists "Owners can insert event categories" on public.event_categories;
drop policy if exists "Owners can update event categories" on public.event_categories;
drop policy if exists "Owners can delete event categories" on public.event_categories;
drop policy if exists "Members can read cat events" on public.cat_events;
drop policy if exists "Owners and editors can insert cat events" on public.cat_events;
drop policy if exists "Owners and editors can update cat events" on public.cat_events;
drop policy if exists "Owners and editors can delete cat events" on public.cat_events;
drop policy if exists "Owners and editors can create cat events" on public.cat_events;
drop policy if exists "Owners can update all events and editors can update own events" on public.cat_events;
drop policy if exists "Owners can delete all events and editors can delete own events" on public.cat_events;
drop policy if exists "Notebook members can read event photos" on storage.objects;
drop policy if exists "Owners and editors can upload event photos" on storage.objects;
drop policy if exists "Owners and editors can delete event photos" on storage.objects;

create policy "Users can read their profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Users can insert their profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can read notebooks"
on public.notebooks for select
to authenticated
using (public.is_notebook_member(id));

create policy "Users can create notebooks"
on public.notebooks for insert
to authenticated
with check (created_by = auth.uid());

create policy "Owners can update notebooks"
on public.notebooks for update
to authenticated
using (public.is_notebook_owner(id))
with check (public.is_notebook_owner(id));

create policy "Members can read notebook members"
on public.notebook_members for select
to authenticated
using (public.is_notebook_member(notebook_id));

create policy "Users can add themselves as notebook owner"
on public.notebook_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and public.is_notebook_creator(notebook_id)
);

create policy "Owners can add notebook members"
on public.notebook_members for insert
to authenticated
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can update notebook members"
on public.notebook_members for update
to authenticated
using (public.is_notebook_owner(notebook_id))
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can delete notebook members"
on public.notebook_members for delete
to authenticated
using (public.is_notebook_owner(notebook_id));

create policy "Members can read cats"
on public.cats for select
to authenticated
using (public.is_notebook_member(notebook_id));

create policy "Owners can insert cats"
on public.cats for insert
to authenticated
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can update cats"
on public.cats for update
to authenticated
using (public.is_notebook_owner(notebook_id))
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can delete cats"
on public.cats for delete
to authenticated
using (public.is_notebook_owner(notebook_id));

create policy "Members can read event categories"
on public.event_categories for select
to authenticated
using (public.is_notebook_member(notebook_id));

create policy "Owners can insert event categories"
on public.event_categories for insert
to authenticated
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can update event categories"
on public.event_categories for update
to authenticated
using (public.is_notebook_owner(notebook_id))
with check (public.is_notebook_owner(notebook_id));

create policy "Owners can delete event categories"
on public.event_categories for delete
to authenticated
using (public.is_notebook_owner(notebook_id));

create policy "Members can read cat events"
on public.cat_events for select
to authenticated
using (public.is_notebook_member(notebook_id));

create policy "Owners and editors can create cat events"
on public.cat_events for insert
to authenticated
with check (
  public.can_create_notebook_event(notebook_id)
  and created_by = auth.uid()
);

create policy "Owners can update all events and editors can update own events"
on public.cat_events for update
to authenticated
using (
  public.is_notebook_owner(notebook_id)
  or (
    public.can_create_notebook_event(notebook_id)
    and created_by = auth.uid()
  )
)
with check (
  public.is_notebook_owner(notebook_id)
  or (
    public.can_create_notebook_event(notebook_id)
    and created_by = auth.uid()
  )
);

create policy "Owners can delete all events and editors can delete own events"
on public.cat_events for delete
to authenticated
using (
  public.is_notebook_owner(notebook_id)
  or (
    public.can_create_notebook_event(notebook_id)
    and created_by = auth.uid()
  )
);

create policy "Notebook members can read event photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'notebooks'
  and public.is_notebook_member(((storage.foldername(name))[2])::uuid)
);

create policy "Owners and editors can upload event photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'notebooks'
  and public.can_create_notebook_event(((storage.foldername(name))[2])::uuid)
  and public.can_upload_event_photo_object(name, metadata)
);

create policy "Owners and editors can delete event photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'notebooks'
  and public.can_create_notebook_event(((storage.foldername(name))[2])::uuid)
);
