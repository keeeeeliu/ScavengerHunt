/**
 * Paper-scorecard results, submitted via a Google Form at the end of the
 * event, get merged into the live leaderboard automatically.
 *
 * Setup: share the Form's response spreadsheet as "anyone with the link can
 * view" and set PAPER_FORM_CSV_URL to its CSV export, e.g.
 *   https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=<GID>
 *
 * Expected form questions (matched by column header, case-insensitive):
 *  - a "team" question  -> the team's code (e.g. BRUNO)
 *  - a "gem" question   -> checkboxes; each option must contain the gem's
 *                          title exactly as it appears in the app
 *  - a "photo" question -> checkboxes for the photos that include every
 *                          team member (+1 each)
 * If a team submits the form more than once, the latest row wins.
 */

export interface PaperResult {
  gemsCell: string; // raw checkbox cell; matched against gem titles
  photosCell: string; // raw checkbox cell of full-team photos
}

/** Minimal CSV parser (handles quoted fields, embedded commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const normTeam = (s: string) => s.trim().toUpperCase();

/**
 * Fetches and parses the form responses. Returns a map keyed by normalized
 * team name. Any failure (unset URL, sheet not shared, network) returns an
 * empty map so the leaderboard always keeps working on app data alone.
 */
export async function loadPaperResults(): Promise<Map<string, PaperResult>> {
  const url = process.env.PAPER_FORM_CSV_URL;
  const results = new Map<string, PaperResult>();
  if (!url) return results;

  let text: string;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return results;
    text = await res.text();
  } catch {
    return results;
  }

  const rows = parseCsv(text);
  if (rows.length < 2) return results;

  const headers = rows[0].map((h) => h.toLowerCase());
  const teamCol = headers.findIndex((h) => h.includes("team") && !h.includes("photo"));
  const gemsCol = headers.findIndex((h) => h.includes("gem"));
  const photosCol = headers.findIndex((h) => h.includes("photo") || h.includes("member"));
  if (teamCol === -1 || gemsCol === -1) return results;

  for (const row of rows.slice(1)) {
    const team = normTeam(row[teamCol] ?? "");
    if (!team) continue;
    // Later rows overwrite earlier ones: a team's newest submission wins.
    results.set(team, {
      gemsCell: row[gemsCol] ?? "",
      photosCell: photosCol === -1 ? "" : row[photosCol] ?? "",
    });
  }
  return results;
}

/** True when the form's checkbox cell claims this gem (matched by title). */
export function cellClaimsGem(gemsCell: string, gemTitle: string): boolean {
  const title = gemTitle.replace(/🐻/g, "").trim();
  return title.length > 0 && gemsCell.includes(title);
}

export { normTeam };
