import { getBest } from '../strategy/resolve';
import { botAction } from './bot';
import { availableActions, handTotal, isBlackjack, isPair, value } from './cards';
import { dealerShouldHit } from './dealer';
import { randomSeed } from './rng';
import { settleHand, settleInsurance } from './settle';
import { newShoe } from './shoe';
import type {
  Card,
  Decision,
  GameEvent,
  GameState,
  Hand,
  PlayerAction,
  Rules,
  Seat,
  SeatIndex,
  SeatType,
} from './types';

export const DEFAULT_RULES: Rules = {
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  lateSurrender: true,
  resplitAces: false,
  maxHandsPerSeat: 4,
};
export const STARTING_BANKROLL = 1000;
export const DEFAULT_BET = 25;
export const SEAT_COUNT = 5;

export interface CreateGameOptions {
  rules?: Partial<Rules>;
  seats?: SeatType[];
  bankroll?: number;
  bet?: number;
  seed?: number;
}

export function createGame(opts: CreateGameOptions = {}): GameState {
  const rules = { ...DEFAULT_RULES, ...opts.rules };
  const seed = opts.seed ?? randomSeed();
  const shoe = newShoe(rules.decks, seed);
  const types = opts.seats ?? ['empty', 'empty', 'you', 'empty', 'empty'];
  const seats: Seat[] = Array.from({ length: SEAT_COUNT }, (_, i) => ({
    index: i as SeatIndex,
    type: types[i] ?? 'empty',
    baseBet: opts.bet ?? DEFAULT_BET,
    hands: [],
  }));
  return {
    rules,
    phase: 'betting',
    shoe: shoe.shoe,
    cutIndex: shoe.cutIndex,
    discard: 0,
    seats,
    dealer: [],
    active: null,
    insurance: {},
    insuranceAnswered: [],
    bankroll: opts.bankroll ?? STARTING_BANKROLL,
    lastDecision: null,
    roundDecisions: [],
    roundNet: 0,
    reshuffled: false,
    rngSeed: shoe.seed,
    nextId: 1,
  };
}

/** Test helper: put these exact cards on top of the shoe and disable the cut card for the next deal. */
export function withShoe(state: GameState, cards: Card[]): GameState {
  return { ...state, shoe: [...cards], cutIndex: 0 };
}

// ---------- queries ----------

export function occupiedSeats(state: GameState): Seat[] {
  return state.seats.filter((s) => s.type !== 'empty');
}

export function youSeats(state: GameState): Seat[] {
  return state.seats.filter((s) => s.type === 'you');
}

export function totalYouBet(state: GameState): number {
  return youSeats(state).reduce((sum, s) => sum + s.baseBet, 0);
}

export function canDeal(state: GameState): boolean {
  if (state.phase !== 'betting') return false;
  if (occupiedSeats(state).length === 0) return false;
  if (youSeats(state).some((s) => s.baseBet <= 0)) return false;
  return totalYouBet(state) <= state.bankroll;
}

/** True when the dealer must take its turn (UI schedules DEALER_STEP). */
export function isDealerTurn(state: GameState): boolean {
  return state.phase === 'dealerTurn';
}

/** True when a bot hand is active (UI schedules BOT_ACT). */
export function isBotTurn(state: GameState): boolean {
  if (state.phase !== 'playerTurns' || !state.active) return false;
  return state.seats[state.active.seatIndex].type === 'bot';
}

export function trueTotal(cards: Card[]): number {
  return handTotal(cards.map((c) => ({ ...c, faceDown: false }))).total;
}

export function dealerHasBlackjack(state: GameState): boolean {
  return state.dealer.length === 2 && trueTotal(state.dealer) === 21;
}

// ---------- reducer ----------

export function reduce(state: GameState, event: GameEvent): GameState {
  const s = structuredClone(state);
  switch (event.type) {
    case 'SET_SEATS':
      if (s.phase !== 'betting') return state;
      s.seats.forEach((seat, i) => (seat.type = event.seats[i] ?? 'empty'));
      return s;
    case 'SET_SEAT':
      if (s.phase !== 'betting' || !s.seats[event.seatIndex]) return state;
      s.seats[event.seatIndex].type = event.seatType;
      return s;
    case 'SET_BET': {
      if (s.phase !== 'betting' || event.amount < 0) return state;
      for (const seat of s.seats) {
        if (event.seatIndex === undefined ? seat.type === 'you' : seat.index === event.seatIndex)
          seat.baseBet = event.amount;
      }
      return s;
    }
    case 'SET_RULES': {
      if (s.phase !== 'betting') return state;
      const decksChanged = s.rules.decks !== event.rules.decks;
      s.rules = { ...event.rules };
      if (decksChanged) {
        const shoe = newShoe(s.rules.decks, s.rngSeed);
        s.shoe = shoe.shoe;
        s.cutIndex = shoe.cutIndex;
        s.rngSeed = shoe.seed;
        s.discard = 0;
      }
      return s;
    }
    case 'SET_BANKROLL':
      if (s.phase !== 'betting') return state;
      s.bankroll = event.amount;
      return s;
    case 'DEAL':
      if (!canDeal(state)) return state;
      deal(s);
      return s;
    case 'INSURANCE': {
      if (s.phase !== 'insurance') return state;
      const seat = s.seats[event.seatIndex];
      if (!seat || seat.type !== 'you' || s.insuranceAnswered.includes(seat.index)) return state;
      const bet = seat.hands[0].bet / 2;
      if (event.take && s.bankroll >= bet) {
        s.insurance[seat.index] = bet;
        s.bankroll -= bet;
      }
      s.insuranceAnswered.push(seat.index);
      if (youSeats(s).every((y) => s.insuranceAnswered.includes(y.index))) peek(s);
      return s;
    }
    case 'ACT':
      if (!act(s, event.action, true, event.now ?? Date.now())) return state;
      return s;
    case 'BOT_ACT': {
      if (!isBotTurn(s)) return state;
      const a = botAction(s);
      if (!a || !act(s, a, false, 0)) return state;
      return s;
    }
    case 'DEALER_STEP':
      if (s.phase !== 'dealerTurn') return state;
      dealerStep(s);
      return s;
    case 'DEALER_PLAY':
      if (s.phase !== 'dealerTurn') return state;
      while (s.phase === 'dealerTurn') dealerStep(s);
      return s;
    case 'NEXT_ROUND': {
      if (s.phase !== 'settled') return state;
      let onTable = s.dealer.length;
      for (const seat of s.seats) {
        for (const h of seat.hands) onTable += h.cards.length;
        seat.hands = [];
      }
      s.discard += onTable;
      s.dealer = [];
      s.active = null;
      s.insurance = {};
      s.insuranceAnswered = [];
      s.phase = 'betting';
      return s;
    }
  }
}

/** Run bots and the dealer until a "you" decision is needed or the round is settled. */
export function runAuto(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 1000; guard++) {
    if (isBotTurn(s)) s = reduce(s, { type: 'BOT_ACT' });
    else if (isDealerTurn(s)) s = reduce(s, { type: 'DEALER_STEP' });
    else return s;
  }
  throw new Error('runAuto did not settle');
}

// ---------- internals (mutate the cloned state) ----------

function draw(s: GameState, faceDown = false): Card {
  if (s.shoe.length === 0) {
    // Safety net: never run dry mid-round.
    const shoe = newShoe(s.rules.decks, s.rngSeed);
    s.shoe = shoe.shoe;
    s.cutIndex = shoe.cutIndex;
    s.rngSeed = shoe.seed;
    s.discard = 0;
  }
  const c = s.shoe.shift()!;
  return faceDown ? { ...c, faceDown: true } : { ...c, faceDown: false };
}

function newHand(s: GameState, seat: Seat, bet: number, cards: Card[] = []): Hand {
  return {
    id: `h${s.nextId++}`,
    seatIndex: seat.index,
    cards,
    bet,
    status: 'waiting',
    result: null,
    payout: 0,
    isSplitHand: false,
    isSplitAces: false,
    doubled: false,
  };
}

function deal(s: GameState) {
  s.reshuffled = false;
  if (s.shoe.length <= s.cutIndex) {
    const shoe = newShoe(s.rules.decks, s.rngSeed);
    s.shoe = shoe.shoe;
    s.cutIndex = shoe.cutIndex;
    s.rngSeed = shoe.seed;
    s.discard = 0;
    s.reshuffled = true;
  }
  s.dealer = [];
  s.active = null;
  s.insurance = {};
  s.insuranceAnswered = [];
  s.roundDecisions = [];
  s.lastDecision = null;
  s.roundNet = 0;

  const seats = occupiedSeats(s);
  for (const seat of seats) {
    seat.hands = [newHand(s, seat, seat.baseBet)];
    if (seat.type === 'you') s.bankroll -= seat.baseBet;
  }
  for (const seat of seats) seat.hands[0].cards.push(draw(s));
  s.dealer.push(draw(s));
  for (const seat of seats) seat.hands[0].cards.push(draw(s));
  s.dealer.push(draw(s, true));

  for (const seat of seats) if (isBlackjack(seat.hands[0])) seat.hands[0].status = 'blackjack';

  if (s.dealer[0].rank === 'A' && youSeats(s).length > 0) {
    s.phase = 'insurance';
    return;
  }
  peek(s);
}

/** US-style peek with an A or 10 up. */
function peek(s: GameState) {
  const upValue = value(s.dealer[0].rank);
  if ((upValue === 11 || upValue === 10) && dealerHasBlackjack(s)) {
    s.dealer = s.dealer.map((c) => ({ ...c, faceDown: false }));
    settleAll(s);
    return;
  }
  s.phase = 'playerTurns';
  s.active = null;
  advance(s);
}

function seatHasRoom(s: GameState, seat: Seat) {
  return seat.hands.length < s.rules.maxHandsPerSeat;
}

/** Mark a freshly two-card hand as active/done/stood. Returns true when it needs a decision. */
function prepareHand(s: GameState, seat: Seat, hand: Hand): boolean {
  if (hand.cards.length === 1) hand.cards.push(draw(s));
  if (hand.isSplitAces) {
    const canResplit = isPair(hand.cards) && s.rules.resplitAces && seatHasRoom(s, seat);
    hand.status = canResplit ? 'active' : 'done';
    return canResplit;
  }
  if (handTotal(hand.cards).total >= 21) {
    hand.status = 'stood';
    return false;
  }
  hand.status = 'active';
  return true;
}

/** Move `active` to the next hand that needs a decision, or hand over to the dealer. */
function advance(s: GameState) {
  const startSeat = s.active?.seatIndex ?? 0;
  const startHand = s.active ? s.active.handIndex + 1 : 0;
  for (let si = startSeat; si < s.seats.length; si++) {
    const seat = s.seats[si];
    if (seat.type === 'empty') continue;
    for (let hi = si === startSeat ? startHand : 0; hi < seat.hands.length; hi++) {
      const hand = seat.hands[hi];
      if (hand.status !== 'waiting') continue;
      if (prepareHand(s, seat, hand)) {
        s.active = { seatIndex: si, handIndex: hi };
        return;
      }
    }
  }
  s.active = null;
  s.phase = 'dealerTurn';
}

function act(s: GameState, action: PlayerAction, record: boolean, now: number): boolean {
  if (s.phase !== 'playerTurns' || !s.active) return false;
  if (!availableActions(s).includes(action)) return false;
  const seat = s.seats[s.active.seatIndex];
  const hand = seat.hands[s.active.handIndex];
  const isYou = seat.type === 'you';

  if (record && isYou) {
    const best = getBest(s);
    if (best) {
      const d: Decision = {
        handKey: best.lookup.handKey,
        chosen: action,
        best: best.action,
        correct: action === best.action,
        timestamp: now,
        seatIndex: seat.index,
        handIndex: s.active.handIndex,
      };
      s.lastDecision = d;
      s.roundDecisions.push(d);
    }
  }

  switch (action) {
    case 'hit': {
      hand.cards.push(draw(s));
      const t = handTotal(hand.cards).total;
      if (t > 21) hand.status = 'busted';
      else if (t === 21) hand.status = 'stood';
      break;
    }
    case 'stand':
      hand.status = 'stood';
      break;
    case 'double':
      if (isYou) s.bankroll -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(s));
      hand.status = handTotal(hand.cards).total > 21 ? 'busted' : 'doubled';
      break;
    case 'surrender':
      hand.status = 'surrendered';
      break;
    case 'split': {
      const [first, second] = hand.cards;
      const aces = first.rank === 'A';
      if (isYou) s.bankroll -= hand.bet;
      const split = newHand(s, seat, hand.bet, [second]);
      split.isSplitHand = true;
      split.isSplitAces = aces;
      hand.cards = [first];
      hand.isSplitHand = true;
      hand.isSplitAces = aces;
      seat.hands.splice(s.active.handIndex + 1, 0, split);
      hand.status = 'waiting';
      if (prepareHand(s, seat, hand)) return true;
      break;
    }
  }
  if (hand.status !== 'active') advance(s);
  return true;
}

function liveHands(s: GameState): Hand[] {
  return s.seats.flatMap((seat) =>
    seat.hands.filter((h) => h.status === 'stood' || h.status === 'doubled' || h.status === 'done'),
  );
}

function dealerStep(s: GameState) {
  const hole = s.dealer.find((c) => c.faceDown);
  if (hole) {
    s.dealer = s.dealer.map((c) => ({ ...c, faceDown: false }));
    return;
  }
  if (liveHands(s).length > 0 && dealerShouldHit(s.dealer, s.rules)) {
    s.dealer.push(draw(s));
    return;
  }
  settleAll(s);
}

function settleAll(s: GameState) {
  const dealerBj = dealerHasBlackjack(s);
  let net = 0;
  for (const seat of s.seats) {
    for (const hand of seat.hands) {
      const { result, payout } = settleHand(hand, s.dealer);
      hand.result = result;
      hand.payout = payout;
      if (seat.type === 'you') {
        s.bankroll += hand.bet + payout;
        net += payout;
      }
    }
  }
  for (const bet of Object.values(s.insurance)) {
    const insNet = settleInsurance(bet, dealerBj);
    if (dealerBj) s.bankroll += bet + insNet;
    net += insNet;
  }
  s.roundNet = net;
  s.active = null;
  s.phase = 'settled';
}
