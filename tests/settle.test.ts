import { expect, test } from 'vitest';
import { settleHand, settleInsurance } from '../src/engine/settle';
import { card } from '../src/engine/shoe';
import type { Hand } from '../src/engine/types';

const hand = (cards: string, extra: Partial<Hand> = {}): Hand => ({
  id: 'h',
  seatIndex: 0,
  cards: cards.split(' ').map((c) => card(c)),
  bet: 10,
  status: 'stood',
  result: null,
  payout: 0,
  isSplitHand: false,
  isSplitAces: false,
  doubled: false,
  ...extra,
});
const d = (cards: string) => cards.split(' ').map((c) => card(c));

test('payouts', () => {
  expect(settleHand(hand('10 9'), d('10 8'))).toEqual({ result: 'win', payout: 10 });
  expect(settleHand(hand('10 8'), d('10 8'))).toEqual({ result: 'push', payout: 0 });
  expect(settleHand(hand('10 7'), d('10 8'))).toEqual({ result: 'lose', payout: -10 });
  expect(settleHand(hand('10 7'), d('10 6 9'))).toEqual({ result: 'win', payout: 10 });
  expect(settleHand(hand('10 7 9'), d('10 6 9'))).toEqual({ result: 'lose', payout: -10 });
  expect(settleHand(hand('A K'), d('10 9'))).toEqual({ result: 'blackjack', payout: 15 });
  expect(settleHand(hand('A K'), d('A Q'))).toEqual({ result: 'push', payout: 0 });
  expect(settleHand(hand('7 7 7'), d('A Q'))).toEqual({ result: 'lose', payout: -10 });
  expect(settleHand(hand('A K', { isSplitHand: true }), d('10 9'))).toEqual({
    result: 'win',
    payout: 10,
  });
  expect(settleHand(hand('10 6', { status: 'surrendered' }), d('10 9'))).toEqual({
    result: 'surrender',
    payout: -5,
  });
});

test('insurance', () => {
  expect(settleInsurance(5, true)).toBe(10);
  expect(settleInsurance(5, false)).toBe(-5);
});
