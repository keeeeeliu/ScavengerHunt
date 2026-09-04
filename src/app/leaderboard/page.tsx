"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [fromAdmin, setFromAdmin] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setRows(data.leaderboard ?? []);
        setUpdatedAt(new Date());
      }
    } catch {
      // Keep last known standings on transient failure.
    }
  }, []);

  useEffect(() => {
    setFromAdmin(new URLSearchParams(window.location.search).get("from") === "admin");
    refresh();

    // Polling fallback (always on) keeps standings fresh even without realtime.
    const id = setInterval(refresh, 10000);

    // Realtime: refetch immediately when any submission changes.
    const supabase = getBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase) {
      channel = supabase
        .channel("leaderboard-submissions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "submissions" },
          () => refresh()
        )
        .subscribe();
    }

    return () => {
      clearInterval(id);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  const maxPoints = rows[0]?.points ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-brown">Leaderboard</h1>
          <p className="text-sm text-stone-500">
            {updatedAt
              ? `Live · updated ${updatedAt.toLocaleTimeString()}`
              : "Loading…"}
          </p>
        </div>
        {fromAdmin ? (
          <Link href="/admin" className="text-sm underline">
            Back to review
          </Link>
        ) : (
          <Link href="/hunt" className="text-sm underline">
            Back to hunt
          </Link>
        )}
      </header>

      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={row.team_id}
            className={`flex items-center gap-3 rounded-2xl border p-4 ${
              i < 3 ? "border-brown/40 bg-white shadow-sm" : "border-stone-200 bg-white"
            }`}
          >
            <div className="w-8 text-center text-xl font-black text-brown">
              {MEDALS[i] ?? i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-stone-900">{row.team_name}</p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-brown transition-all"
                  style={{
                    width: maxPoints > 0 ? `${(row.points / maxPoints) * 100}%` : "0%",
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-400">
                {row.approved_count} gem{row.approved_count === 1 ? "" : "s"} approved
                {row.bear_bonus > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                    🐻 all bears +{row.bear_bonus}
                  </span>
                )}
                {row.top_collector_bonus > 0 && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                    🏆 most gems +{row.top_collector_bonus}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-brown">{row.points}</p>
              <p className="text-xs text-stone-400">pts</p>
            </div>
          </li>
        ))}
      </ol>

      {rows.length === 0 && (
        <p className="py-10 text-center text-stone-500">
          No teams yet. Standings appear as photos get approved.
        </p>
      )}
    </main>
  );
}
