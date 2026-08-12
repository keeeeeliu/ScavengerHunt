# Brown Orientation Scavenger Hunt

A mobile-first photo-collection app for a ~50-60 person orientation scavenger hunt.
Teams join with a code, upload a photo at each **gem**, organizers approve/score
submissions from an admin dashboard, and a **live leaderboard** ranks teams.

Built with **Next.js (App Router) + TypeScript + Tailwind** and **Supabase**
(Postgres + Storage + Realtime). Photos are compressed in the browser before
upload and stored in a private bucket; the browser never sees the service key.

## How it works

```
/join        Enter team code  -> saved in localStorage
/hunt         Team's gem list, take/upload a photo per gem (the core screen)
/admin        Organizer passcode gate -> approve / reject / score submissions
/leaderboard  Live standings (realtime + polling fallback)
```

Photo uploads go through server route handlers (`/api/submit`, `/api/review`, ...)
that use the Supabase **service role key**, so no per-user auth is needed.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at https://supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). This
   creates the tables, the private `photos` storage bucket, and enables realtime.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in values from your Supabase project
(Settings -> API):

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server only, keep secret)
- `ADMIN_PASSCODE` — the passcode organizers type at `/admin`

### 4. Seed routes, gems, and teams

Edit [`data/hunt.json`](data/hunt.json) with your real routes, gems, and team
codes, then run:

```bash
npm run seed
```

Re-running is safe — it upserts on `route.slug`, `gem.slug`, and `team.code`, so
you can update content later and re-seed without creating duplicates.

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Try a team code from `data/hunt.json` (e.g. `BEAR12`).

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add the four environment variables from `.env.local` in the Vercel project settings.
3. Deploy. Share the URL + team codes with participants; open `/leaderboard` on a
   projector and `/admin` on the organizer laptop.

## Updating routes / gems during the event

Edit `data/hunt.json` and run `npm run seed` again. Gems are matched by `slug`,
so existing submissions are preserved.

## Data model

- `routes` — a named route (`slug`, `name`)
- `gems` — a photo objective (`route_id` nullable = shared/bonus gem, `points`)
- `teams` — `name`, unique join `code`, optional `route_id`
- `submissions` — one row per `(team, gem)`; `status` pending/approved/rejected,
  `points_awarded`. Re-submitting a gem overwrites the previous photo and resets
  it to pending.
