import { describe, expect, test } from 'vitest';
import {
  availableActions,
  handTotal,
  isBlackjack,
  isPair,
  disabledReason,
} from '../src/engine/cards';
import { dealerShouldHit } from '../src/engine/dealer';
import { parseHandKey, stackDrill } from '../src/engine/drill';
import { createGame, reduce, runAuto, canDeal } from '../src/engine/game';
import { nextRandom } from '../src/engine/rng';
import { buildDecks, card, newShoe, shuffle } from '../src/engine/shoe';
import type { GameState, PlayerAction } from '../src/engine/types';
import { stacked } from './helpers';

const act = (s: GameState, action: PlayerAction) => reduce(s, { type: 'ACT', action, now: 1 });
const deal = (s: GameState) => reduce(s, { type: 'DEAL' });
const hands = (s: GameState, seat = 2) => s.seats[seat].hands;

describe('cards', () => {
  test('totals and soft hands', () => {
    expect(handTotal([card('A'), card('6')])).toEqual({ total: 17, soft: true });
    expect(handTotal([card('A'), card('6'), card('10')])).toEqual({ total: 17, soft: false });
    expect(handTotal([card('A'), card('A'), card('9')])).toEqual({ total: 21, soft: true });
    expect(handTotal([card('K'), card('Q'), card('5')]).total).toBe(25);
  });
  test('pairs by value and blackjack', () => {
    expect(isPair([card('K'), card('Q')])).toBe(true);
    expect(isPair([card('9'), card('10')])).toBe(false);
    expect(isBlackjack({ cards: [card('A'), card('K')], isSplitHand: false })).toBe(true);
    expect(isBlackjack({ cards: [card('A'), card('K')], isSplitHand: true })).toBe(false);
  });
  test('dealer S17 / H17', () => {
    expect(dealerShouldHit([card('A'), card('6')], { dealerHitsSoft17: false })).toBe(false);
    expect(dealerShouldHit([card('A'), card('6')], { dealerHitsSoft17: true })).toBe(true);
    expect(dealerShouldHit([card('10'), card('6')], { dealerHitsSoft17: false })).toBe(true);
    expect(dealerShouldHit([card('10'), card('7')], { dealerHitsSoft17: true })).toBe(false);
  });
});

describe('shoe and rng', () => {
  test('rng is deterministic', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextRandom(42)[0]).not.toBe(nextRandom(43)[0]);
  });
  test('shuffle keeps all cards, seeded', () => {
    const d = buildDecks(6);
    expect(d).toHaveLength(312);
    const a = shuffle(d, 7).items;
    expect(a).toHaveLength(312);
    expect(new Set(a.map((c) => c.id)).size).toBe(312);
    expect(shuffle(d, 7).items.map((c) => c.id)).toEqual(a.map((c) => c.id));
  });
  test('cut card at 75%', () => {
    expect(newShoe(6, 1).cutIndex).toBe(78);
  });
  test('reshuffle at the cut card', () => {
    let s = createGame({ seed: 3 });
    s = { ...s, shoe: s.shoe.slice(0, s.cutIndex), discard: 234 };
    s = deal(s);
    expect(s.reshuffled).toBe(true);
    expect(s.discard).toBe(0);
    expect(s.shoe.length).toBe(312 - 4);
  });
});

describe('dealing', () => {
  test('deal order: seats left→right, dealer up, second cards, hole face down', () => {
    // seats 1 and 3 (index 1 and 2); order: s1, s2, up, s1, s2, hole
    let s = stacked('2 3 9 4 5 7', { seats: ['empty', 'you', 'bot', 'empty', 'empty'] });
    s = deal(s);
    expect(s.seats[1].hands[0].cards.map((c) => c.rank)).toEqual(['2', '4']);
    expect(s.seats[2].hands[0].cards.map((c) => c.rank)).toEqual(['3', '5']);
    expect(s.dealer.map((c) => c.rank)).toEqual(['9', '7']);
    expect(s.dealer[1].faceDown).toBe(true);
    expect(s.bankroll).toBe(975);
    expect(s.phase).toBe('playerTurns');
    expect(s.active).toEqual({ seatIndex: 1, handIndex: 0 });
  });
  test('cannot deal over bankroll', () => {
    let s = createGame({ bankroll: 10 });
    expect(canDeal(s)).toBe(false);
    expect(deal(s)).toBe(s);
  });
});

describe('blackjacks and peek', () => {
  test('player blackjack vs dealer blackjack pushes', () => {
    let s = deal(stacked('A K K A'));
    // Dealer shows K and has A in the hole → peek → blackjack.
    expect(s.phase).toBe('settled');
    expect(hands(s)[0].result).toBe('push');
    expect(s.bankroll).toBe(1000);
  });
  test('player blackjack pays 3:2', () => {
    let s = deal(stacked('A 9 K 8'));
    expect(hands(s)[0].status).toBe('blackjack');
    expect(s.phase).toBe('dealerTurn');
    s = runAuto(s);
    expect(hands(s)[0].result).toBe('blackjack');
    expect(hands(s)[0].payout).toBe(37.5);
    expect(s.bankroll).toBe(1037.5);
    // Dealer never drew, only blackjacks on the table.
    expect(s.dealer).toHaveLength(2);
  });
  test('dealer blackjack beats non-blackjack hands', () => {
    let s = deal(stacked('10 A 9 K'));
    expect(s.phase).toBe('insurance');
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: false });
    expect(s.phase).toBe('settled');
    expect(hands(s)[0].result).toBe('lose');
    expect(s.bankroll).toBe(975);
  });
  test('insurance pays 2:1 when the dealer has blackjack', () => {
    let s = deal(stacked('10 A 9 K'));
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: true });
    expect(s.insurance[2]).toBe(12.5);
    // -25 hand, +25 insurance
    expect(s.roundNet).toBe(0);
    expect(s.bankroll).toBe(1000);
  });
  test('insurance is lost when the dealer has no blackjack', () => {
    let s = deal(stacked('10 A 9 7'));
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: true });
    expect(s.phase).toBe('playerTurns');
    expect(s.bankroll).toBe(1000 - 25 - 12.5);
    s = runAuto(act(s, 'stand'));
    // 19 vs dealer 18 → win 25, insurance -12.5
    expect(hands(s)[0].result).toBe('win');
    expect(s.roundNet).toBe(12.5);
    expect(s.bankroll).toBe(1012.5);
  });
  test('bots never take insurance and the prompt only waits for you', () => {
    let s = deal(stacked('10 5 A 9 6 7', { seats: ['empty', 'bot', 'you', 'empty', 'empty'] }));
    expect(s.phase).toBe('insurance');
    s = reduce(s, { type: 'INSURANCE', seatIndex: 1, take: true });
    expect(s.insuranceAnswered).toEqual([]);
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: false });
    expect(s.phase).toBe('playerTurns');
    expect(s.insurance).toEqual({});
  });
});

describe('player actions', () => {
  test('hit, bust, dealer skips drawing when everyone busted', () => {
    let s = deal(stacked('10 6 6 5 K'));
    s = act(s, 'hit');
    expect(hands(s)[0].status).toBe('busted');
    expect(s.phase).toBe('dealerTurn');
    s = runAuto(s);
    expect(s.dealer).toHaveLength(2);
    expect(hands(s)[0].result).toBe('lose');
    expect(s.bankroll).toBe(975);
  });
  test('dealer draws to 17 and busts', () => {
    // you 10,8 = 18; dealer 6,10 → draws K → bust
    let s = deal(stacked('10 6 8 10 K'));
    s = runAuto(act(s, 'stand'));
    expect(s.dealer.map((c) => c.rank)).toEqual(['6', '10', 'K']);
    expect(hands(s)[0].result).toBe('win');
    expect(s.bankroll).toBe(1025);
  });
  test('H17 dealer hits soft 17', () => {
    let s = deal(stacked('10 A 8 6 3', { rules: { dealerHitsSoft17: true } }));
    s = reduce(s, { type: 'INSURANCE', seatIndex: 2, take: false });
    s = runAuto(act(s, 'stand'));
    expect(s.dealer.map((c) => c.rank)).toEqual(['A', '6', '3']);
    expect(hands(s)[0].result).toBe('lose');
  });
  test('double takes exactly one card and doubles the bet', () => {
    let s = deal(stacked('6 5 5 10 9 7'));
    expect(availableActions(s)).toContain('double');
    s = act(s, 'double');
    const h = hands(s)[0];
    expect(h.cards).toHaveLength(3);
    expect(h.bet).toBe(50);
    expect(h.status).toBe('doubled');
    expect(s.bankroll).toBe(950);
    s = runAuto(s);
    // 20 vs dealer 5,10,7 = 22 → win 50
    expect(h.doubled).toBe(true);
    expect(s.bankroll).toBe(1050);
  });
  test('surrender only as the first decision', () => {
    let s = deal(stacked('10 9 6 10 2'));
    expect(availableActions(s)).toContain('surrender');
    const after = act(s, 'hit');
    expect(after.phase).toBe('playerTurns');
    expect(availableActions(after)).not.toContain('surrender');
    expect(disabledReason(after, 'surrender')).toBe('Only as first decision');
    s = runAuto(act(s, 'surrender'));
    expect(hands(s)[0].result).toBe('surrender');
    expect(s.bankroll).toBe(987.5);
  });
  test('surrender off removes the action', () => {
    const s = deal(stacked('10 9 6 10', { rules: { lateSurrender: false } }));
    expect(availableActions(s)).not.toContain('surrender');
  });
  test('illegal actions are ignored', () => {
    const s = deal(stacked('10 9 6 10'));
    expect(act(s, 'split')).toBe(s);
  });
});

describe('splitting', () => {
  test('split aces get one card each and are done', () => {
    let s = deal(stacked('A 6 A 10 9 5 7'));
    s = act(s, 'split');
    const [h1, h2] = hands(s);
    expect(h1.cards.map((c) => c.rank)).toEqual(['A', '9']);
    expect(h2.cards.map((c) => c.rank)).toEqual(['A', '5']);
    expect(h1.status).toBe('done');
    expect(h2.status).toBe('done');
    expect(s.phase).toBe('dealerTurn');
    expect(s.bankroll).toBe(950);
    s = runAuto(s);
    // dealer 6,10,7 = 23 bust
    expect(hands(s).map((h) => h.result)).toEqual(['win', 'win']);
    expect(s.bankroll).toBe(1050);
  });
  test('21 after split is not blackjack', () => {
    let s = deal(stacked('A 6 A 10 K 5 7'));
    s = runAuto(act(s, 'split'));
    expect(hands(s)[0].result).toBe('win');
    expect(hands(s)[0].payout).toBe(25);
  });
  test('re-split aces when allowed', () => {
    let s = deal(stacked('A 6 A 10 A 5 9 7', { rules: { resplitAces: true } }));
    s = act(s, 'split');
    expect(availableActions(s)).toEqual(['split', 'stand']);
    s = act(s, 'split');
    expect(hands(s)).toHaveLength(3);
  });
  test('no re-split aces by default', () => {
    let s = deal(stacked('A 6 A 10 A 5 9 7'));
    s = act(s, 'split');
    expect(hands(s)[0].status).toBe('done');
    expect(hands(s)[0].cards.map((c) => c.rank)).toEqual(['A', 'A']);
  });
  test('re-split up to 4 hands, play order follows split order', () => {
    // 8,8 → each new 8 is split again until 4 hands.
    let s = deal(stacked('8 6 8 10 8 8 8 3 2 4 5 9'));
    s = act(s, 'split'); // h1: 8,8  h2: 8
    s = act(s, 'split'); // h1: 8,8  h2: 8 h3: 8
    s = act(s, 'split'); // h1: 8,8  4 hands, no room left
    expect(hands(s)).toHaveLength(4);
    expect(availableActions(s)).not.toContain('split');
    expect(disabledReason(s, 'split')).toBe('Max hands reached');
    expect(s.active).toEqual({ seatIndex: 2, handIndex: 0 });
    s = act(s, 'stand');
    expect(s.active).toEqual({ seatIndex: 2, handIndex: 1 });
    expect(hands(s)[1].cards).toHaveLength(2);
    expect(hands(s)[1].isSplitHand).toBe(true);
    expect(s.bankroll).toBe(900);
  });
  test('max hands reached', () => {
    let s = deal(stacked('8 6 8 10 8 8', { rules: { maxHandsPerSeat: 2 } }));
    s = act(s, 'split');
    expect(availableActions(s)).not.toContain('split');
    expect(disabledReason(s, 'split')).toBe('Max hands reached');
  });
  test('DAS on allows double after split, DAS off does not', () => {
    const order = '8 6 8 10 3 9 9';
    let on = act(deal(stacked(order)), 'split');
    expect(availableActions(on)).toContain('double');
    let off = act(deal(stacked(order, { rules: { doubleAfterSplit: false } })), 'split');
    expect(availableActions(off)).not.toContain('double');
    expect(disabledReason(off, 'double')).toBe('No double after split');
    // No surrender after a split.
    expect(availableActions(on)).not.toContain('surrender');
  });
});

describe('multi-seat', () => {
  test('bots play perfect strategy and seats play left to right', () => {
    let s = stacked('10 9 10 6 K 8 5', { seats: ['empty', 'you', 'bot', 'empty', 'empty'] });
    s = deal(s);
    expect(s.active).toEqual({ seatIndex: 1, handIndex: 0 });
    s = act(s, 'stand');
    expect(s.active).toEqual({ seatIndex: 2, handIndex: 0 });
    s = reduce(s, { type: 'BOT_ACT' });
    // bot has 9,8 = 17 vs 10 → stand
    expect(s.seats[2].hands[0].status).toBe('stood');
    expect(s.phase).toBe('dealerTurn');
  });
  test('decisions are recorded only for you', () => {
    let s = deal(stacked('10 6 6 10', { seats: ['empty', 'empty', 'you', 'empty', 'empty'] }));
    s = act(s, 'hit');
    expect(s.lastDecision?.handKey).toBe('hard-16-vs-6');
    expect(s.lastDecision?.correct).toBe(false);
    expect(s.lastDecision?.best).toBe('stand');
  });
  test('next round moves cards to the discard and keeps bets', () => {
    let s = deal(stacked('10 6 6 10 K'));
    s = runAuto(act(s, 'stand'));
    s = reduce(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('betting');
    expect(s.discard).toBe(5);
    expect(s.seats[2].baseBet).toBe(25);
    expect(s.seats[2].hands).toEqual([]);
  });
});

describe('drills', () => {
  test('parse hand keys', () => {
    expect(parseHandKey('soft-18-vs-9')).toEqual({ player: ['A', '7'], upcard: '9' });
    expect(parseHandKey('pair-8-vs-A')).toEqual({ player: ['8', '8'], upcard: 'A' });
    const hard = parseHandKey('hard-11-vs-6')!;
    expect(hard.upcard).toBe('6');
    expect(handTotal(hard.player.map((r) => card(r))).total).toBe(11);
    expect(parseHandKey('nope')).toBeNull();
  });
  test('stacked drill deals the situation to your first hand', () => {
    let s = createGame({ seed: 9, seats: ['bot', 'empty', 'you', 'bot', 'empty'] });
    s = stackDrill(s, { player: ['A', '7'], upcard: '9' });
    s = deal(s);
    expect(s.seats[2].hands[0].cards.map((c) => c.rank)).toEqual(['A', '7']);
    expect(s.dealer[0].rank).toBe('9');
  });
});
