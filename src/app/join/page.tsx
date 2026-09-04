"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTeam, loadTeam, saveTeam } from "@/lib/teamSession";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A device joins one team and stays on it: if a team is already saved, go
  // straight to the hunt. Organizers can fix a wrong join via /join?switch=1,
  // which clears the saved team and shows the form again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("switch") === "1") {
      clearTeam();
      return;
    }
    if (loadTeam()) router.replace("/hunt");
  }, [router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join. Try again.");
        return;
      }
      saveTeam(data.team);
      router.replace("/hunt");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brown text-2xl font-black text-white">
          B
        </div>
        <h1 className="text-2xl font-bold text-brown">Orientation Scavenger Hunt</h1>
        <p className="mt-1 text-sm text-stone-500">
          Enter your team code to start hunting.
        </p>
      </div>

      <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-stone-700">
              Team code
            </label>
            <input
              id="code"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. BRUNO"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg tracking-widest focus:border-brown focus:outline-none focus:ring-2 focus:ring-brown/30"
            />
            <p className="mt-1 text-xs text-stone-400">
              Ask your orientation leader or a teammate for your team&apos;s code.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full rounded-xl bg-brown px-4 py-3 text-lg font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join team"}
          </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-400">
        <Link href="/leaderboard" className="underline">
          View the live leaderboard
        </Link>
      </p>
    </main>
  );
}
