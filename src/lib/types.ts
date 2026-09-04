export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Route {
  id: number;
  slug: string;
  name: string;
}

export interface Gem {
  id: number;
  slug: string;
  route_id: number | null;
  title: string;
  description: string | null;
  order_index: number;
  points: number;
}

export interface Team {
  id: number;
  name: string;
  code: string;
  route_id: number | null;
}

export interface Submission {
  id: number;
  team_id: number;
  gem_id: number;
  photo_path: string;
  status: SubmissionStatus;
  points_awarded: number;
  submitted_at: string;
  reviewed_at: string | null;
}

/** A gem plus this team's submission for it (if any). Used by the /hunt screen. */
export interface GemWithSubmission extends Gem {
  submission: Submission | null;
}

export interface LeaderboardRow {
  team_id: number;
  team_name: string;
  approved_count: number;
  /** Sum of points_awarded on approved submissions, before bonuses. */
  base_points: number;
  /** +5 when the team has approved photos of every bear gem (🐻 in title). */
  bear_bonus: number;
  /** +3 while the team holds (or ties for) the most approved gems. */
  top_collector_bonus: number;
  /** base_points + bear_bonus + top_collector_bonus — what the standings rank by. */
  points: number;
}
