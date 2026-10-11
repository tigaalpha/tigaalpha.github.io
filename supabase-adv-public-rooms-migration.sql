-- Adventure Online, phase O4: a public room list so strangers can find each other (plan 33).
-- WRITTEN, NOT APPLIED. The owner reviews and runs this in the Supabase SQL editor; nothing in the app calls it yet.
-- Additive and re-runnable. A room is only an advertisement (code, host name, map, mode, pilot count); the game itself still
-- runs over the Realtime channel advo:<CODE>, so no gameplay data and no rewards pass through this table.

create table if not exists public.adv_public_rooms (
  code        text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host_id     uuid not null references auth.users(id) on delete cascade,
  host_name   text not null check (char_length(host_name) between 1 and 14),
  map_id      text not null default '' check (char_length(map_id) <= 24),
  war         boolean not null default false,
  pilots      smallint not null default 1 check (pilots between 1 and 4),
  updated_at  timestamptz not null default now()
);

create index if not exists adv_public_rooms_updated_idx on public.adv_public_rooms (updated_at desc);

alter table public.adv_public_rooms enable row level security;

-- Anyone signed in may read rooms that were refreshed in the last 90 seconds (an abandoned room disappears by itself).
drop policy if exists adv_rooms_read on public.adv_public_rooms;
create policy adv_rooms_read on public.adv_public_rooms for select to authenticated
  using (updated_at > now() - interval '90 seconds');

-- A host writes only their own row; one open room per host.
drop policy if exists adv_rooms_host_write on public.adv_public_rooms;
create policy adv_rooms_host_write on public.adv_public_rooms for all to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

create unique index if not exists adv_public_rooms_one_per_host on public.adv_public_rooms (host_id);

-- Opening (or re-opening) a room: replaces the host's previous row and keeps the table small.
create or replace function public.adv_room_open(p_code text, p_name text, p_map text, p_war boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from public.adv_public_rooms where host_id = auth.uid() or updated_at < now() - interval '10 minutes';
  insert into public.adv_public_rooms (code, host_id, host_name, map_id, war, pilots)
  values (upper(p_code), auth.uid(), left(coalesce(nullif(p_name, ''), 'Pilot'), 14), left(coalesce(p_map, ''), 24), coalesce(p_war, false), 1);
end $$;

-- The host's heartbeat: keeps the room listed and updates the pilot count and chosen map.
create or replace function public.adv_room_ping(p_code text, p_pilots int, p_map text, p_war boolean)
returns void language sql security definer set search_path = public as $$
  update public.adv_public_rooms
     set updated_at = now(), pilots = greatest(1, least(4, p_pilots)), map_id = left(coalesce(p_map, ''), 24), war = coalesce(p_war, false)
   where code = upper(p_code) and host_id = auth.uid();
$$;

create or replace function public.adv_room_close(p_code text)
returns void language sql security definer set search_path = public as $$
  delete from public.adv_public_rooms where code = upper(p_code) and host_id = auth.uid();
$$;

-- The list the lobby shows: open rooms that still have a free seat, newest first.
create or replace function public.adv_rooms_list()
returns table (code text, host_name text, map_id text, war boolean, pilots smallint)
language sql security definer stable set search_path = public as $$
  select code, host_name, map_id, war, pilots from public.adv_public_rooms
   where updated_at > now() - interval '90 seconds' and pilots < 4
   order by updated_at desc limit 20;
$$;

revoke all on function public.adv_room_open(text, text, text, boolean) from public;
revoke all on function public.adv_room_ping(text, int, text, boolean) from public;
revoke all on function public.adv_room_close(text) from public;
revoke all on function public.adv_rooms_list() from public;
grant execute on function public.adv_room_open(text, text, text, boolean) to authenticated;
grant execute on function public.adv_room_ping(text, int, text, boolean) to authenticated;
grant execute on function public.adv_room_close(text) to authenticated;
grant execute on function public.adv_rooms_list() to authenticated;
