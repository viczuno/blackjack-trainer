import { expect, test } from 'vitest';
import { createGame, reduce, runAuto } from '../src/engine/game';
import type { GameState } from '../src/engine/types';
import { getBest } from '../src/strategy/resolve';

function playRounds(s: GameState, rounds: number, chooseInsurance: (round: number) => boolean) {
  const start = s.bankroll;
  let sumNet = 0;
  for (let round = 0; round < rounds; round++) {
    s = reduce(s, { type: 'DEAL' });
    expect(s.phase).not.toBe('betting');
    for (let guard = 0; guard < 500 && s.phase !== 'settled'; guard++) {
      if (s.phase === 'insurance') {
        for (const seat of s.seats.filter((x) => x.type === 'you'))
          s = reduce(s, { type: 'INSURANCE', seatIndex: seat.index, take: chooseInsurance(round) });
      } else if (
        s.phase === 'playerTurns' &&
        s.active &&
        s.seats[s.active.seatIndex].type === 'you'
      ) {
        s = reduce(s, { type: 'ACT', action: getBest(s)!.action });
      } else {
        s = runAuto(s);
      }
    }
    expect(s.phase).toBe('settled');
    sumNet += s.roundNet;
    s = reduce(s, { type: 'NEXT_ROUND' });
  }
  return { s, start, sumNet };
}

test('100 bot-only rounds finish without errors', () => {
  const { s } = playRounds(
    createGame({ seed: 2024, seats: ['bot', 'bot', 'bot', 'bot', 'bot'] }),
    100,
    () => false,
  );
  expect(s.phase).toBe('betting');
});

test('bankroll change equals the sum of payouts (strategy play, splits, doubles, insurance)', () => {
  for (const seed of [1, 77, 4242]) {
    const g = createGame({ seed, seats: ['bot', 'you', 'empty', 'you', 'bot'], bankroll: 100000 });
    const { s, start, sumNet } = playRounds(g, 100, (r) => r % 3 === 0);
    expect(s.bankroll - start).toBeCloseTo(sumNet, 6);
    expect(s.roundDecisions.every((d) => d.correct)).toBe(true);
  }
});
