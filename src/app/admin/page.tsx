"use client";

import { useCallback, useEffect, useState } from "react";

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

const PASSCODE_KEY = "scavenger.admin.passcode";

export default function AdminPage() {
  const [passcode, setPasscode] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("pending");
  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthed(true);
    }
  }, []);

  const fetchSubs = useCallback(
    async (code: string, f: Filter) => {
      setLoading(true);
      try {
        const q = f === "all" ? "" : `?status=${f}`;
        const res = await fetch(`/api/admin/submissions${q}`, {
          headers: { "x-admin-passcode": code },
        });
        if (res.status === 401) {
          setAuthed(false);
          setAuthError("Wrong passcode.");
          sessionStorage.removeItem(PASSCODE_KEY);
          return;
        }
        const data = await res.json();
        setSubs(data.submissions ?? []);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!authed) return;
    fetchSubs(passcode, filter);
    const id = setInterval(() => fetchSubs(passcode, filter), 8000);
    return () => clearInterval(id);
  }, [authed, passcode, filter, fetchSubs]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const res = await fetch("/api/admin/submissions?status=pending", {
      headers: { "x-admin-passcode": input },
    });
    if (res.ok) {
      sessionStorage.setItem(PASSCODE_KEY, input);
      setPasscode(input);
      setAuthed(true);
    } else {
      setAuthError("Wrong passcode.");
    }
  }

  async function review(sub: AdminSubmission, action: "approve" | "reject", points?: number) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-passcode": passcode },
      body: JSON.stringify({ submissionId: sub.id, action, points }),
    });
    if (res.ok) {
      // Refresh the current view.
      fetchSubs(passcode, filter);
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
          <button className="w-full rounded-xl bg-brown px-4 py-3 font-semibold text-white">
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brown">Review queue</h1>
        <a href="/leaderboard" className="text-sm underline">
          Leaderboard
        </a>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 font-medium capitalize ${
              filter === f ? "bg-brown text-white" : "bg-stone-200 text-stone-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && subs.length === 0 && (
        <p className="py-10 text-center text-stone-500">Loading…</p>
      )}
      {!loading && subs.length === 0 && (
        <p className="py-10 text-center text-stone-500">Nothing here right now.</p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subs.map((sub) => (
          <ReviewCard key={sub.id} sub={sub} onReview={review} />
        ))}
      </ul>
    </main>
  );
}

function ReviewCard({
  sub,
  onReview,
}: {
  sub: AdminSubmission;
  onReview: (sub: AdminSubmission, action: "approve" | "reject", points?: number) => void;
}) {
  const [points, setPoints] = useState<number>(sub.points_awarded || sub.gem_points);

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
            className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => onReview(sub, "approve", points)}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Approve
          </button>
          <button
            onClick={() => onReview(sub, "reject")}
            className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}
