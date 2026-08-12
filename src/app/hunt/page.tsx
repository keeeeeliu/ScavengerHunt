"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTeam, loadTeam } from "@/lib/teamSession";
import { GemCard, type HuntGem, type HuntSubmission } from "@/components/GemCard";
import type { Team } from "@/lib/types";

export default function HuntPage() {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [gems, setGems] = useState<HuntGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/hunt?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load your hunt.");
        return;
      }
      setTeam(data.team);
      setGems(data.gems);
    } catch {
      setError("Network error. Pull to refresh once you're back online.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = loadTeam();
    if (!saved) {
      router.replace("/join");
      return;
    }
    setTeam(saved);
    load(saved.code);
  }, [router, load]);

  function handleUpdated(gemId: number, submission: HuntSubmission) {
    setGems((prev) =>
      prev.map((g) => (g.id === gemId ? { ...g, submission } : g))
    );
  }

  function handleSwitchTeam() {
    clearTeam();
    router.replace("/join");
  }

  const approvedPoints = gems.reduce(
    (sum, g) => sum + (g.submission?.status === "approved" ? g.submission.points_awarded : 0),
    0
  );
  const submittedCount = gems.filter((g) => g.submission).length;

  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-stone-200 bg-stone-100/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-stone-400">Team</p>
            <h1 className="truncate text-lg font-bold text-brown">{team?.name ?? "…"}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-stone-400">Points</p>
            <p className="text-lg font-bold text-brown">{approvedPoints}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
          <span>
            {submittedCount}/{gems.length} gems submitted
          </span>
          <span className="flex gap-3">
            <Link href="/leaderboard" className="underline">
              Leaderboard
            </Link>
            <button onClick={handleSwitchTeam} className="underline">
              Switch team
            </button>
          </span>
        </div>
      </header>

      {loading && <p className="py-10 text-center text-stone-500">Loading your gems…</p>}

      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={() => team && load(team.code)}
            className="mt-2 block font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && gems.length === 0 && (
        <p className="py-10 text-center text-stone-500">
          No gems assigned yet. Check back with an organizer.
        </p>
      )}

      <ul className="space-y-3">
        {gems.map((gem) => (
          <GemCard
            key={gem.id}
            gem={gem}
            teamCode={team?.code ?? ""}
            onUpdated={handleUpdated}
          />
        ))}
      </ul>
    </main>
  );
}
