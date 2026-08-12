import type { Team } from "./types";

const KEY = "scavenger.team";

export function saveTeam(team: Team) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(team));
}

export function loadTeam(): Team | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Team;
  } catch {
    return null;
  }
}

export function clearTeam() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
