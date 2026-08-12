"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadTeam } from "@/lib/teamSession";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const team = loadTeam();
    router.replace(team ? "/hunt" : "/join");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-stone-500">Loading…</p>
    </main>
  );
}
