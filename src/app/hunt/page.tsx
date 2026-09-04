"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTeam, loadTeam, saveTeam } from "@/lib/teamSession";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import { GemCard, type HuntGem, type HuntSubmission } from "@/components/GemCard";
import type { Team } from "@/lib/types";

export default function HuntPage() {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [gems, setGems] = useState<HuntGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sequence guard: only the newest in-flight request may apply its result,
  // so a slow background poll can never overwrite fresher state.
  const loadSeq = useRef(0);

  const load = useCallback(async (code: string, background = false) => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`/api/hunt?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (seq !== loadSeq.current) return;
      if (res.status === 404) {
        // Saved code no longer matches a team (wiped or reseeded database):
        // forget it and ask for a code again instead of dead-ending here.
        clearTeam();
        router.replace("/join");
        return;
      }
      if (!res.ok) {
        if (!background) setError(data.error ?? "Could not load your hunt.");
        return;
      }
      setError(null);
      setTeam(data.team);
      setGems(data.gems);
      // Keep the stored copy current: after a wipe + reseed the team keeps its
      // code but gets a new id, and the realtime filter needs the fresh id.
      saveTeam(data.team);
    } catch {
      // Background refreshes fail silently and keep the last known state.
      if (seq === loadSeq.current && !background) {
        setError("Network error. Pull to refresh once you're back online.");
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const saved = loadTeam();
    if (!saved) {
      router.replace("/join");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") setJustCreated(true);
    setTeam(saved);
    load(saved.code);

    // Keep the whole team in sync: teammates' uploads and admin reviews
    // appear without a manual refresh.
    const id = setInterval(() => load(saved.code, true), 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(saved.code, true);
    };
    document.addEventListener("visibilitychange", onVisible);

    const supabase = getBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase) {
      channel = supabase
        .channel(`hunt-team-${saved.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "submissions",
            filter: `team_id=eq.${saved.id}`,
          },
          () => load(saved.code, true)
        )
        .subscribe();
    }

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [router, load]);

  async function copyCode() {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the code is shown on screen regardless.
    }
  }

  function handleUpdated(gemId: number, submission: HuntSubmission) {
    setGems((prev) =>
      prev.map((g) => (g.id === gemId ? { ...g, submission } : g))
    );
    // Resync from the server: invalidates any stale in-flight poll and picks
    // up anything teammates submitted in the meantime.
    if (team) load(team.code, true);
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
          <span className="flex items-center gap-3">
            {team?.code && (
              <button
                onClick={copyCode}
                title="Tap to copy — share with teammates"
                className="font-mono font-semibold tracking-widest text-brown underline decoration-dotted"
              >
                {copied ? "Copied!" : `Code ${team.code}`}
              </button>
            )}
            <Link href="/map" className="underline">
              Map
            </Link>
            <Link href="/leaderboard" className="underline">
              Leaderboard
            </Link>
          </span>
        </div>
      </header>

      {justCreated && team && (
        <div className="mb-4 rounded-2xl border border-brown/20 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-brown">Team created! 🎉</p>
          <p className="mt-1 text-sm text-stone-600">
            Share this code so teammates can join on their own phones:
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-xl bg-stone-100 px-4 py-2 font-mono text-2xl font-black tracking-[0.3em] text-brown">
              {team.code}
            </span>
            <button
              onClick={copyCode}
              className="rounded-xl bg-brown px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(false)}
            className="mt-3 text-xs text-stone-400 underline"
          >
            Got it, hide this
          </button>
        </div>
      )}

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
