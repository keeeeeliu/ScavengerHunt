"use client";

import { useCallback, useEffect, useState } from "react";

interface TeamRow {
  id: number;
  name: string;
  code: string;
  submitted: number;
  approved: number;
  points: number;
}

const PASSCODE_KEY = "scavenger.admin.passcode";

export default function AdminTeamsPage() {
  const [passcode, setPasscode] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthed(true);
    }
  }, []);

  const fetchTeams = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/admin/teams", {
        headers: { "x-admin-passcode": code },
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Wrong passcode.");
        sessionStorage.removeItem(PASSCODE_KEY);
        return;
      }
      if (!res.ok) {
        setPageError(`Could not refresh (HTTP ${res.status}).`);
        return;
      }
      const data = await res.json();
      setTeams(data.teams ?? []);
      setPageError(null);
    } catch {
      setPageError("Network error while refreshing.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchTeams(passcode);
    const id = setInterval(() => fetchTeams(passcode), 10000);
    return () => clearInterval(id);
  }, [authed, passcode, fetchTeams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/teams", {
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
        setAuthError(`Server error (HTTP ${res.status}).`);
      }
    } catch {
      setAuthError("Network error — is the app running?");
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brown">Teams ({teams.length})</h1>
        <div className="flex gap-4 text-sm">
          <a href="/admin" className="underline">
            Review queue
          </a>
          <a href="/admin/map" className="underline">
            Map
          </a>
          <a href="/leaderboard?from=admin" className="underline">
            Leaderboard
          </a>
        </div>
      </div>

      {pageError && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{pageError}</p>
      )}

      {!loaded && <p className="py-10 text-center text-stone-500">Loading…</p>}
      {loaded && teams.length === 0 && (
        <p className="py-10 text-center text-stone-500">
          No teams yet. Teams appear here as groups create them from the join screen.
        </p>
      )}

      {teams.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2 text-right">Submitted</th>
                <th className="px-4 py-2 text-right">Approved</th>
                <th className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {teams.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-semibold text-stone-900">{t.name}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => navigator.clipboard?.writeText(t.code)}
                      title="Copy code"
                      className="font-mono font-semibold tracking-widest text-brown underline decoration-dotted"
                    >
                      {t.code}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600">{t.submitted}</td>
                  <td className="px-4 py-2 text-right text-stone-600">{t.approved}</td>
                  <td className="px-4 py-2 text-right font-bold text-brown">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
