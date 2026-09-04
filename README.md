# Brown Orientation Scavenger Hunt

A mobile-first photo-collection app for a ~50-60 person orientation scavenger hunt.
Teams join with a code, upload a photo at each **gem**, organizers approve/score
submissions from an admin dashboard, and a **live leaderboard** ranks teams.

Built with **Next.js (App Router) + TypeScript + Tailwind** and **Supabase**
(Postgres + Storage + Realtime). Photos are compressed in the browser before
upload and stored in a private bucket; the browser never sees the service key.

## How it works

```
/join         Start a team (type a name -> get a shareable code) OR join with a
              code. Saved in localStorage; a joined device is locked to its team.
              /join?switch=1 (organizer escape hatch) clears it to re-join.
/hunt         Team's gem list, take/upload a photo per gem (the core screen).
              Shows the team's code in the header so teammates can join.
/map          Interactive campus map of every gem (Leaflet + OpenStreetMap)
/admin        Organizer passcode gate -> approve / reject / score submissions
/admin/teams  Organizer view of every live-created team and its code
/leaderboard  Live standings (realtime + polling fallback)
```

Teams are **not** preset. Each group creates its own team on the day from
`/join` (which generates a short, unambiguous code like `B7KPQ`), then shares
that code so teammates can join from their own phones. This handles any number of
groups without knowing the count in advance.

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

### 4. Seed routes and gems

Edit [`data/hunt.json`](data/hunt.json) with your real routes and gems, then run:

```bash
npm run seed
```

Re-running is safe — it upserts on `route.slug` and `gem.slug`, so you can update
content later and re-seed without creating duplicates. **Teams are not seeded** —
participants create them live at `/join`. (The `teams` array in `hunt.json` is
normally empty; anything listed there is pre-created, which is handy for testing.)

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Click **Start a team**, enter a name, and you'll get
a code to test the join flow on a second device/tab.

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add the four environment variables from `.env.local` in the Vercel project settings.
3. Deploy. Share the one URL with participants (each group taps **Start a team**);
   open `/leaderboard` on a projector and `/admin` on the organizer laptop.
   Use `/admin/teams` to see every team and its code.

## Updating routes / gems during the event

Edit `data/hunt.json` and run `npm run seed` again. Gems are matched by `slug`,
so existing submissions are preserved.

The full organizer-facing gem guide (artists, fun facts, bonus rules) lives in
[`data/gem-guide.md`](data/gem-guide.md).

## Gem map

`/map` renders every gem from `data/hunt.json` on an OpenStreetMap base layer
(no API key needed). Pins are numbered by `order_index` and colored by the
team's submission status when a team is joined on the device.

Each gem's `lat`/`lng` in `hunt.json` feeds the map only — the seed script does
not store them in the database. The current coordinates are close estimates: to
fine-tune one, open `/map`, click the exact spot, and copy the
`"lat": ..., "lng": ...` snippet from the popup into `hunt.json`.

## Data model

- `routes` — a named route (`slug`, `name`)
- `gems` — a photo objective (`route_id` nullable = shared/bonus gem, `points`)
- `teams` — `name`, unique join `code` (auto-generated when a group starts a team
  at `/join`), optional `route_id`
- `submissions` — one row per `(team, gem)`; `status` pending/approved/rejected,
  `points_awarded`. Re-submitting a gem overwrites the previous photo and resets
  it to pending.
