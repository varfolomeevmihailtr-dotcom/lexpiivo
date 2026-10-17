-- LEX PIIVO / Server 347
-- Supabase SQL Editor migration 001
-- Run only in a dedicated Supabase project. Do not expose service_role keys.
create extension if not exists pgcrypto;

create table if not exists public.lex_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game_nick text not null check (char_length(trim(game_nick)) between 2 and 40),
  clan_role text not null default 'player' check (clan_role in ('player','officer','admin')),
  created_at timestamptz not null default now()
);
create unique index if not exists lex_profiles_nick_unique on public.lex_profiles (lower(game_nick));

create or replace function public.lex_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  candidate := left(trim(coalesce(new.raw_user_meta_data->>'game_nick','')),40);
  if length(candidate)<2 then candidate:='player_'||substr(new.id::text,1,8); end if;
  insert into public.lex_profiles(user_id,game_nick) values(new.id,candidate);
  return new;
end $$;
drop trigger if exists lex_auth_user_created on auth.users;
create trigger lex_auth_user_created after insert on auth.users
for each row execute function public.lex_create_profile();

create or replace function public.lex_is_officer()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.lex_profiles where user_id=(select auth.uid()) and clan_role in ('officer','admin')) $$;

create table if not exists public.lex_player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb
    check (octet_length(payload::text)<=200000),
  updated_at timestamptz not null default now()
);

create table if not exists public.lex_race_sessions (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  time_label text not null check(time_label in ('14:00','23:00')),
  time_zone text not null,
  capacity integer check (capacity is null or capacity>0),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_date,time_label)
);
-- A player can sign up for either or both race sessions.
create table if not exists public.lex_race_signups (
  session_id uuid not null references public.lex_race_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(session_id,user_id)
);

create table if not exists public.lex_incidents (
  id uuid primary key default gen_random_uuid(),
  player_nick text not null check (char_length(trim(player_nick)) between 2 and 80),
  server_number integer check(server_number between 1 and 99999),
  alliance_tag text,
  incident_date date not null,
  description text not null check(char_length(description) between 5 and 2000),
  evidence_url text,
  status text not null default 'active' check(status in ('active','resolved','disputed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable row-level security before any client access.
alter table public.lex_profiles enable row level security;
alter table public.lex_player_progress enable row level security;
alter table public.lex_race_sessions enable row level security;
alter table public.lex_race_signups enable row level security;
alter table public.lex_incidents enable row level security;

-- Remove default public permissions, then grant only required operations.
revoke all on public.lex_profiles,public.lex_player_progress,public.lex_race_sessions,public.lex_race_signups,public.lex_incidents from anon,authenticated;
grant select on public.lex_profiles to authenticated;
grant update(game_nick) on public.lex_profiles to authenticated;
grant select,insert,update,delete on public.lex_player_progress to authenticated;
grant select,insert,update,delete on public.lex_race_sessions to authenticated;
grant select,insert,delete on public.lex_race_signups to authenticated;
grant select,insert,update,delete on public.lex_incidents to authenticated;
grant execute on function public.lex_is_officer() to authenticated;

create policy lex_profiles_read on public.lex_profiles for select to authenticated using (true);
create policy lex_profiles_edit_nick on public.lex_profiles for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy lex_progress_read on public.lex_player_progress for select to authenticated using (user_id=(select auth.uid()));
create policy lex_progress_insert on public.lex_player_progress for insert to authenticated with check (user_id=(select auth.uid()));
create policy lex_progress_update on public.lex_player_progress for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy lex_progress_delete on public.lex_player_progress for delete to authenticated using (user_id=(select auth.uid()));

create policy lex_sessions_read on public.lex_race_sessions for select to authenticated using (true);
create policy lex_sessions_add on public.lex_race_sessions for insert to authenticated with check ((select public.lex_is_officer()));
create policy lex_sessions_edit on public.lex_race_sessions for update to authenticated using ((select public.lex_is_officer())) with check ((select public.lex_is_officer()));
create policy lex_sessions_delete on public.lex_race_sessions for delete to authenticated using ((select public.lex_is_officer()));

create policy lex_signups_read on public.lex_race_signups for select to authenticated using (true);
create policy lex_signups_add on public.lex_race_signups for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.lex_race_sessions s where s.id=session_id and s.is_open));
create policy lex_signups_delete on public.lex_race_signups for delete to authenticated
  using (user_id=(select auth.uid()) or (select public.lex_is_officer()));

create policy lex_incidents_read on public.lex_incidents for select to authenticated using (true);
create policy lex_incidents_add on public.lex_incidents for insert to authenticated
  with check ((select public.lex_is_officer()) and created_by=(select auth.uid()));
create policy lex_incidents_edit on public.lex_incidents for update to authenticated
  using ((select public.lex_is_officer())) with check ((select public.lex_is_officer()));
create policy lex_incidents_delete on public.lex_incidents for delete to authenticated
  using ((select public.lex_is_officer()));

-- Assign the first admin ONLY via the Supabase SQL Editor after signing up:
-- update public.lex_profiles set clan_role='admin' where user_id='<UUID from Auth > Users>';
-- Note: capacity needs a server-side transactional check before enforcing limits.
