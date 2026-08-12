-- Scavenger Hunt schema. Run this in the Supabase SQL editor once per project.

create table if not exists routes (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null
);

create table if not exists gems (
  id bigint generated always as identity primary key,
  slug text not null unique,
  route_id bigint references routes(id) on delete set null,
  title text not null,
  description text,
  order_index int not null default 0,
  points int not null default 10
);

create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null,
  code text not null unique,
  route_id bigint references routes(id) on delete set null
);

create table if not exists submissions (
  id bigint generated always as identity primary key,
  team_id bigint not null references teams(id) on delete cascade,
  gem_id bigint not null references gems(id) on delete cascade,
  photo_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points_awarded int not null default 0,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (team_id, gem_id)
);

create index if not exists submissions_status_idx on submissions (status);
create index if not exists submissions_team_idx on submissions (team_id);

-- Private storage bucket for photos. Access is via server-generated signed URLs.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Enable realtime for the live leaderboard. Guarded so this file can be re-run:
-- `alter publication ... add table` errors if the table is already a member.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'submissions'
     )
  then
    alter publication supabase_realtime add table submissions;
  end if;
end $$;

-- Row Level Security: all writes happen through the server using the service
-- role key (which bypasses RLS). We enable RLS everywhere and add NO policies to
-- routes/gems/teams, so anon clients cannot read them directly.
alter table routes enable row level security;
alter table gems enable row level security;
alter table teams enable row level security;
alter table submissions enable row level security;

-- The leaderboard uses a realtime subscription with the anon key. Realtime
-- respects RLS, so submissions need a read policy for events to be delivered.
-- Submissions hold no sensitive data (photos live in a private bucket), and the
-- leaderboard is public, so anon SELECT is acceptable.
drop policy if exists "anon can read submissions" on submissions;
create policy "anon can read submissions" on submissions
  for select using (true);
