import type { VoteTargetType, VoteValue } from "@/lib/types";

export interface VoteRow {
  target_id: string;
  user_id: string;
  value: number;
}

export interface VoteSummary {
  score: number;
  userVote: VoteValue | null;
}

/** Aggregates vote rows into a score and the current user's vote per target. */
export function summarizeVotes(
  votes: VoteRow[],
  targetIds: string[],
  currentUserId: string | null
): Map<string, VoteSummary> {
  const summaries = new Map<string, VoteSummary>();

  for (const id of targetIds) {
    summaries.set(id, { score: 0, userVote: null });
  }

  for (const vote of votes) {
    const summary = summaries.get(vote.target_id) ?? {
      score: 0,
      userVote: null,
    };

    summary.score += vote.value;

    if (currentUserId && vote.user_id === currentUserId) {
      summary.userVote = vote.value === 1 || vote.value === -1 ? vote.value : null;
    }

    summaries.set(vote.target_id, summary);
  }

  return summaries;
}

export function emptyVoteSummary(): VoteSummary {
  return { score: 0, userVote: null };
}

export type { VoteTargetType, VoteValue };
