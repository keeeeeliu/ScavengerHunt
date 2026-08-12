"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveTeam } from "@/lib/teamSession";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
          Enter your team code to start collecting gems.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="e.g. BEAR12"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg tracking-widest focus:border-brown focus:outline-none focus:ring-2 focus:ring-brown/30"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full rounded-xl bg-brown px-4 py-3 text-lg font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? "Joining…" : "Start hunting"}
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
