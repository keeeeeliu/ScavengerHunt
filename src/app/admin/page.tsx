"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AdminSubmission {
  id: number;
  team_id: number;
  gem_id: number;
  team_name: string;
  gem_title: string;
  gem_points: number;
  status: string;
  points_awarded: number;
  submitted_at: string;
  photo_url: string | null;
}

type Filter = "pending" | "approved" | "rejected" | "all";
type ReviewAction = "approve" | "reject";

const PASSCODE_KEY = "scavenger.admin.passcode";
const FILTERS: Filter[] = ["pending", "approved", "rejected", "all"];

export default function AdminPage() {
  const [passcode, setPasscode] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("pending");
  // Always fetch every submission and filter client-side: tab switches are
  // instant, the tab chips can show live counts, and a poll response can never
  // disagree with a review that happened between request and response.
  const [allSubs, setAllSubs] = useState<AdminSubmission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: number; action: ReviewAction } | null>(null);
  // Monotonic request id so an out-of-order (stale) response is ignored.
  const reqSeq = useRef(0);

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthed(true);
    }
  }, []);

  const fetchSubs = useCallback(async (code: string) => {
    const seq = ++reqSeq.current;
    try {
      const res = await fetch("/api/admin/submissions", {
        headers: { "x-admin-passcode": code },
        cache: "no-store",
      });
      if (seq !== reqSeq.current) return; // a newer request superseded this one
      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Wrong passcode.");
        sessionStorage.removeItem(PASSCODE_KEY);
        return;
      }
      if (!res.ok) {
        setPageError(`Could not refresh (HTTP ${res.status}). Showing the last known list.`);
        return;
      }
      const data = await res.json();
      if (seq !== reqSeq.current) return;
      setAllSubs(data.submissions ?? []);
      setPageError(null);
    } catch {
      if (seq === reqSeq.current) {
        setPageError("Network error while refreshing. Showing the last known list.");
      }
    } finally {
      if (seq === reqSeq.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchSubs(passcode);
    const id = setInterval(() => fetchSubs(passcode), 8000);
    return () => clearInterval(id);
  }, [authed, passcode, fetchSubs]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        headers: { "x-admin-passcode": input },
        cache: "no-store",
      });
      if (res.ok) {
        sessionStorage.setItem(PASSCODE_KEY, input);
        setPasscode(input);
        setAuthed(true);
        setLoaded(false);
      } else if (res.status === 401) {
        setAuthError("Wrong passcode.");
      } else {
        setAuthError(`Server error (HTTP ${res.status}) — check that the dev server is healthy.`);
      }
    } catch {
      setAuthError("Network error — is the app running?");
    }
  }

  async function review(sub: AdminSubmission, action: ReviewAction, points?: number) {
    setBusy({ id: sub.id, action });
    setPageError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-passcode": passcode },
        body: JSON.stringify({ submissionId: sub.id, action, points }),
      });
      if (!res.ok) {
        setPageError(`Could not ${action} — HTTP ${res.status}. Try again.`);
        return;
      }
      const data = await res.json();
      // Apply the result immediately (the card leaves/joins tabs on the spot);
      // the next poll reconciles with the server.
      setAllSubs((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: data.submission.status,
                points_awarded: data.submission.points_awarded,
              }
            : s
        )
      );
    } catch {
      setPageError(`Network error — could not ${action}. Try again.`);
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="mb-4 text-xl font-bold text-brown">Organizer login</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin passcode"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 focus:border-brown focus:outline-none"
          />
          {authError && <p className="text-sm text-red-600">{authError}</p>}
          <button className="w-full rounded-xl bg-brown px-4 py-3 font-semibold text-white transition active:scale-[0.99]">
            Enter
          </button>
        </form>
      </main>
    );
  }

  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const s of allSubs) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const visible = filter === "all" ? allSubs : allSubs.filter((s) => s.status === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brown">Review queue</h1>
        <div className="flex gap-4 text-sm">
          <a href="/admin/teams" className="underline">
            Teams
          </a>
          <a href="/admin/map" className="underline">
            Map
          </a>
          <a href="/leaderboard?from=admin" className="underline">
            Leaderboard
          </a>
        </div>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {FILTERS.map((f) => {
          const count = f === "all" ? allSubs.length : counts[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition active:scale-95 ${
                filter === f ? "bg-brown text-white" : "bg-stone-200 text-stone-600"
              }`}
            >
              {f} {loaded ? `(${count})` : ""}
            </button>
          );
        })}
      </div>

      {pageError && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{pageError}</p>
      )}

      {!loaded && <p className="py-10 text-center text-stone-500">Loading…</p>}
      {loaded && visible.length === 0 && (
        <p className="py-10 text-center text-stone-500">
          {filter === "pending" ? "No submissions waiting for review." : "Nothing here right now."}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((sub) => (
          <ReviewCard
            key={sub.id}
            sub={sub}
            busyAction={busy?.id === sub.id ? busy.action : null}
            onReview={review}
          />
        ))}
      </ul>

      <ResetSection passcode={passcode} />
    </main>
  );
}

function ResetSection({ passcode }: { passcode: string }) {
  const [open, setOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"ok" | "err">("ok");

  async function handleReset() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-passcode": passcode },
        body: JSON.stringify({ resetCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageKind("err");
        setMessage(data.error ?? `Reset failed (HTTP ${res.status}).`);
        return;
      }
      setMessageKind("ok");
      setMessage(
        `✅ Game reset. Deleted ${data.photos_deleted} photo(s); reseeded ${data.teams_seeded} teams and ${data.gems_seeded} gems. Scores are back to zero.`
      );
      setResetCode("");
      setOpen(false);
    } catch {
      setMessageKind("err");
      setMessage("Network error — the reset may not have run. Check the leaderboard.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
      <h2 className="text-sm font-bold text-rose-700">Danger zone</h2>
      <p className="mt-1 text-sm text-stone-600">
        Reset the game for a new round: deletes <strong>all photos, submissions, and
        teams</strong>, then recreates the teams with the same codes. Gem points and
        calibrated map pins are kept. This cannot be undone.
      </p>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            messageKind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}
        >
          {message}
        </p>
      )}

      {!open ? (
        <button
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="mt-3 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition active:scale-[0.98]"
        >
          🔄 Reset game…
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="reset-code" className="block text-sm font-medium text-stone-700">
            Enter the reset code to confirm
          </label>
          <input
            id="reset-code"
            type="password"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
            placeholder="Reset code"
            disabled={running}
            className="w-full max-w-xs rounded-xl border border-stone-300 px-4 py-2.5 focus:border-rose-500 focus:outline-none disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={running || !resetCode.trim()}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {running ? "Resetting…" : "Permanently reset the game"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setResetCode("");
              }}
              disabled={running}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  sub,
  busyAction,
  onReview,
}: {
  sub: AdminSubmission;
  busyAction: ReviewAction | null;
  onReview: (sub: AdminSubmission, action: ReviewAction, points?: number) => void;
}) {
  const [points, setPoints] = useState<number>(sub.points_awarded || sub.gem_points);
  const busy = busyAction !== null;

  return (
    <li className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {sub.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sub.photo_url} alt="" className="h-56 w-full bg-stone-100 object-contain" />
      ) : (
        <div className="flex h-56 items-center justify-center bg-stone-100 text-stone-400">
          No photo
        </div>
      )}
      <div className="p-3">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold text-stone-900">{sub.team_name}</p>
          <span
            className={`text-xs font-semibold capitalize ${
              sub.status === "approved"
                ? "text-emerald-600"
                : sub.status === "rejected"
                ? "text-red-600"
                : "text-amber-600"
            }`}
          >
            {sub.status}
          </span>
        </div>
        <p className="text-sm text-stone-500">{sub.gem_title}</p>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            disabled={busy}
            className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm disabled:opacity-50"
          />
          <button
            onClick={() => onReview(sub, "approve", points)}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/25 ring-1 ring-inset ring-white/25 transition hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97] disabled:opacity-50"
          >
            <span aria-hidden>✓</span>
            {busyAction === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => onReview(sub, "reject")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-rose-400 to-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-700/25 ring-1 ring-inset ring-white/25 transition hover:to-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 active:scale-[0.97] disabled:opacity-50"
          >
            <span aria-hidden>✕</span>
            {busyAction === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </li>
  );
}
