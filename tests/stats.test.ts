import { expect, test } from 'vitest';
import type { Decision } from '../src/engine/types';
import {
  accuracy,
  emptyStats,
  handKeyLabel,
  loadStats,
  mostMissed,
  recordDecision,
  recordRound,
  saveStats,
  STATS_KEY,
} from '../src/stats/stats';

const dec = (handKey: string, correct: boolean): Decision => ({
  handKey,
  correct,
  chosen: 'hit',
  best: correct ? 'hit' : 'stand',
  timestamp: 0,
  seatIndex: 0,
  handIndex: 0,
});

test('accuracy, streaks, most missed', () => {
  let s = emptyStats();
  expect(accuracy(s)).toBeNull();
  s = recordDecision(s, dec('hard-16-vs-10', true));
  s = recordDecision(s, dec('hard-16-vs-10', true));
  s = recordDecision(s, dec('soft-18-vs-9', false));
  s = recordDecision(s, dec('soft-18-vs-9', false));
  expect(mostMissed(s)).toBeNull(); // needs 3 seen
  s = recordDecision(s, dec('soft-18-vs-9', false));
  s = recordDecision(s, dec('hard-12-vs-3', true));
  expect(accuracy(s)).toBe(50);
  expect(s.streak).toBe(1);
  expect(s.bestStreak).toBe(2);
  expect(mostMissed(s)?.handKey).toBe('soft-18-vs-9');
  expect(s.accuracyHistory.at(-1)).toBe(50);
});

test('round history keeps the last 20 / 100', () => {
  let s = emptyStats();
  for (let i = 0; i < 120; i++) s = recordRound(s, i, 1000 + i);
  expect(s.lastRounds).toHaveLength(20);
  expect(s.lastRounds[19]).toBe(119);
  expect(s.bankrollHistory).toHaveLength(100);
});

test('labels and persistence', () => {
  expect(handKeyLabel('pair-8-vs-A')).toBe('8,8 vs A');
  expect(handKeyLabel('soft-18-vs-9')).toBe('Soft 18 vs 9');
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  saveStats(storage, recordDecision(emptyStats(), dec('hard-11-vs-10', true)));
  expect(store.has(STATS_KEY)).toBe(true);
  expect(loadStats(storage).decisions).toBe(1);
  expect(loadStats({ getItem: () => '{bad json' }).decisions).toBe(0);
});
