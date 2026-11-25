import type { Decision } from '../engine/types';

export const STATS_KEY = 'bjt:stats:v1';

export interface Stats {
  decisions: number;
  correct: number;
  streak: number;
  bestStreak: number;
  perHand: Record<string, { seen: number; wrong: number }>;
  /** Net result of the last 20 rounds, oldest first. */
  lastRounds: number[];
  /** Bankroll after each of the last 100 rounds, oldest first. */
  bankrollHistory: number[];
  /** Accuracy % after each of the last 100 decisions, oldest first (for the chart). */
  accuracyHistory: number[];
}

export function emptyStats(): Stats {
  return {
    decisions: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    perHand: {},
    lastRounds: [],
    bankrollHistory: [],
    accuracyHistory: [],
  };
}

const keepLast = <T>(arr: T[], n: number) => (arr.length > n ? arr.slice(arr.length - n) : arr);

export function recordDecision(stats: Stats, d: Decision): Stats {
  const decisions = stats.decisions + 1;
  const correct = stats.correct + (d.correct ? 1 : 0);
  const streak = d.correct ? stats.streak + 1 : 0;
  const prev = stats.perHand[d.handKey] ?? { seen: 0, wrong: 0 };
  return {
    ...stats,
    decisions,
    correct,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    perHand: {
      ...stats.perHand,
      [d.handKey]: { seen: prev.seen + 1, wrong: prev.wrong + (d.correct ? 0 : 1) },
    },
    accuracyHistory: keepLast(
      [...stats.accuracyHistory, Math.round((correct / decisions) * 1000) / 10],
      100,
    ),
  };
}

export function recordRound(stats: Stats, net: number, bankroll: number): Stats {
  return {
    ...stats,
    lastRounds: keepLast([...stats.lastRounds, net], 20),
    bankrollHistory: keepLast([...stats.bankrollHistory, bankroll], 100),
  };
}

export function accuracy(stats: Stats): number | null {
  return stats.decisions === 0 ? null : (stats.correct / stats.decisions) * 100;
}

export interface MissedHand {
  handKey: string;
  seen: number;
  wrong: number;
}

/** Hands you got wrong, most-missed first. */
export function missedHands(stats: Stats, minSeen = 1): MissedHand[] {
  return Object.entries(stats.perHand)
    .filter(([, v]) => v.wrong > 0 && v.seen >= minSeen)
    .map(([handKey, v]) => ({ handKey, ...v }))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.seen - a.wrong / a.seen);
}

/** "Most missed" = the hand with the most wrong answers, seen at least 3 times. */
export function mostMissed(stats: Stats): MissedHand | null {
  return missedHands(stats, 3)[0] ?? null;
}

/** "hard-11-vs-10" → "Hard 11 vs 10", "pair-8-vs-A" → "8,8 vs A". */
export function handKeyLabel(key: string): string {
  const m = /^(hard|soft|pair)-(\w+)-vs-(\w+)$/.exec(key);
  if (!m) return key;
  const [, kind, what, up] = m;
  if (kind === 'pair') return `${what},${what} vs ${up}`;
  return `${kind === 'soft' ? 'Soft' : 'Hard'} ${what} vs ${up}`;
}

export function loadStats(storage: Pick<Storage, 'getItem'> | undefined): Stats {
  try {
    const raw = storage?.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(storage: Pick<Storage, 'setItem'> | undefined, stats: Stats) {
  try {
    storage?.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage full or unavailable: stats stay in memory
  }
}
