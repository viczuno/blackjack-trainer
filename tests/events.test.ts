import { describe, expect, test } from 'vitest';
import { activeHand, disabledReason } from '../src/engine/cards';
import { parseHandKey, stackDrill } from '../src/engine/drill';
import {
  createGame,
  DEFAULT_RULES,
  isBotTurn,
  reduce,
  runAuto,
  totalYouBet,
} from '../src/engine/game';
import { card } from '../src/engine/shoe';
import { botAction } from '../src/engine/bot';
import type { GameEvent } from '../src/engine/types';
import { stacked } from './helpers';

describe('betting-phase events', () => {
  test('seats, bets, rules, bankroll', () => {
    let s = createGame({ seed: 5 });
    s = reduce(s, { type: 'SET_SEATS', seats: ['you', 'bot', 'you'] });
    expect(s.seats.map((x) => x.type)).toEqual(['you', 'bot', 'you', 'empty', 'empty']);
    s = reduce(s, { type: 'SET_SEAT', seatIndex: 4, seatType: 'bot' });
    expect(s.seats[4].type).toBe('bot');
    s = reduce(s, { type: 'SET_BET', amount: 100 });
    expect(totalYouBet(s)).toBe(200);
    s = reduce(s, { type: 'SET_BET', amount: 50, seatIndex: 0 });
    expect(totalYouBet(s)).toBe(150);
    expect(reduce(s, { type: 'SET_BET', amount: -1 })).toBe(s);
    s = reduce(s, { type: 'SET_RULES', rules: { ...DEFAULT_RULES, decks: 8 } });
    expect(s.shoe).toHaveLength(416);
    s = reduce(s, {
      type: 'SET_RULES',
      rules: { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: true },
    });
    expect(s.shoe).toHaveLength(416);
    s = reduce(s, { type: 'SET_BANKROLL', amount: 1000 });
    expect(s.bankroll).toBe(1000);
  });
  test('events are ignored outside their phase', () => {
    const s = reduce(stacked('10 9 6 10'), { type: 'DEAL' });
    expect(s.phase).toBe('playerTurns');
    for (const e of [
      { type: 'SET_SEATS', seats: [] },
      { type: 'SET_SEAT', seatIndex: 0, seatType: 'bot' },
      { type: 'SET_BET', amount: 5 },
      { type: 'SET_RULES', rules: DEFAULT_RULES },
      { type: 'SET_BANKROLL', amount: 5 },
      { type: 'DEAL' },
      { type: 'INSURANCE', seatIndex: 2, take: true },
      { type: 'BOT_ACT' },
      { type: 'DEALER_STEP' },
      { type: 'DEALER_PLAY' },
      { type: 'NEXT_ROUND' },
    ] as GameEvent[]) {
      expect(reduce(s, e)).toBe(s);
    }
    expect(isBotTurn(s)).toBe(false);
    expect(botAction(s)).toBe('surrender'); // 16 vs 10
  });
  test('DEALER_PLAY runs the whole dealer turn', () => {
    let s = reduce(stacked('10 6 8 10 K'), { type: 'DEAL' });
    s = reduce(s, { type: 'ACT', action: 'stand' });
    s = reduce(s, { type: 'DEALER_PLAY' });
    expect(s.phase).toBe('settled');
  });
  test('the shoe never runs dry mid-round', () => {
    let s = createGame({ seed: 4 });
    s = { ...s, shoe: [card('10'), card('6'), card('6'), card('10')], cutIndex: 0 };
    s = reduce(s, { type: 'DEAL' });
    s = reduce(s, { type: 'ACT', action: 'hit' });
    expect(activeHand(s) ?? s.seats[2].hands[0]).toBeTruthy();
    expect(s.shoe.length).toBeGreaterThan(200);
    if (s.phase === 'playerTurns') s = reduce(s, { type: 'ACT', action: 'stand' });
    s = runAuto(s);
    expect(s.phase).toBe('settled');
  });
});

describe('disabled reasons', () => {
  test('not your turn / split aces / bankroll', () => {
    expect(disabledReason(createGame(), 'hit')).toBe('Not your turn');
    let s = reduce(stacked('A 6 A 10 A 5 9 7', { rules: { resplitAces: true } }), { type: 'DEAL' });
    s = reduce(s, { type: 'ACT', action: 'split' });
    expect(disabledReason(s, 'hit')).toBe('Split aces get one card');
    expect(disabledReason(s, 'double')).toBe('Split aces get one card');
    expect(disabledReason(s, 'stand')).toBeNull();
    const poor = reduce(stacked('8 6 8 10', { bankroll: 30 }), { type: 'DEAL' });
    expect(disabledReason(poor, 'double')).toBe('Not enough bankroll');
    expect(disabledReason(poor, 'split')).toBe('Not enough bankroll');
    const off = reduce(stacked('8 6 9 10', { rules: { lateSurrender: false } }), { type: 'DEAL' });
    expect(disabledReason(off, 'surrender')).toBe('Surrender is off');
    expect(disabledReason(off, 'split')).toBe('Not a pair');
    const hit = reduce(off, { type: 'ACT', action: 'hit' });
    expect(disabledReason(hit, 'double')).toBe('Only on first two cards');
    let split = reduce(stacked('8 6 8 10 3 9'), { type: 'DEAL' });
    split = reduce(split, { type: 'ACT', action: 'split' });
    expect(disabledReason(split, 'surrender')).toBe('Not after a split');
  });
  test('no re-split of aces reason', () => {
    let s = reduce(stacked('A 6 A 10 A 5', { rules: { resplitAces: true, maxHandsPerSeat: 2 } }), {
      type: 'DEAL',
    });
    s = reduce(s, { type: 'ACT', action: 'split' });
    expect(s.phase).toBe('dealerTurn');
  });
});

describe('drill edge cases', () => {
  test('hard 4 and hard 20, soft 12, bad keys', () => {
    expect(parseHandKey('hard-4-vs-6')?.player).toEqual(['2', '2']);
    expect(parseHandKey('hard-20-vs-6')?.player).toEqual(['10', 'K']);
    expect(parseHandKey('soft-12-vs-6')?.player).toEqual(['A', 'A']);
    expect(parseHandKey('soft-21-vs-6')).toBeNull();
    expect(parseHandKey('hard-3-vs-6')).toBeNull();
  });
  test('drill reshuffles a nearly empty shoe and keeps the cut card', () => {
    let s = createGame({ seed: 12 });
    s = { ...s, shoe: s.shoe.slice(0, 50) };
    s = stackDrill(s, { player: ['10', '6'], upcard: 'K' });
    expect(s.cutIndex).toBe(78);
    s = reduce(s, { type: 'DEAL' });
    expect(s.seats[2].hands[0].cards.map((c) => c.rank)).toEqual(['10', '6']);
    expect(s.phase).toBe('playerTurns');
  });
  test('drill without a you seat is a no-op', () => {
    const s = createGame({ seats: ['bot'] });
    expect(stackDrill(s, { player: ['10', '6'], upcard: '9' })).toBe(s);
  });
  test('drill with an ace up never gives the dealer blackjack', () => {
    let s = stackDrill(createGame({ seed: 3 }), { player: ['10', '6'], upcard: 'A' });
    s = reduce(s, { type: 'DEAL' });
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: false });
    expect(s.phase).toBe('playerTurns');
  });
});
