export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card {
  rank: Rank;
  suit: Suit;
  id: string;
  faceDown?: boolean;
}

export type HandStatus =
  'waiting' | 'active' | 'stood' | 'busted' | 'doubled' | 'surrendered' | 'blackjack' | 'done';
export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender' | null;
export interface Hand {
  id: string;
  seatIndex: number;
  cards: Card[];
  bet: number;
  status: HandStatus;
  result: HandResult;
  /** Net win/loss of the hand after settlement (e.g. +25, -25, +37.5). */
  payout: number;
  isSplitHand: boolean;
  isSplitAces: boolean;
  doubled: boolean;
}

export type SeatType = 'empty' | 'you' | 'bot';
export type SeatIndex = 0 | 1 | 2 | 3 | 4;
export interface Seat {
  index: SeatIndex;
  type: SeatType;
  baseBet: number;
  hands: Hand[];
}

export interface Rules {
  decks: 4 | 6 | 8;
  dealerHitsSoft17: boolean;
  doubleAfterSplit: boolean;
  lateSurrender: boolean;
  resplitAces: boolean;
  maxHandsPerSeat: 2 | 3 | 4;
}

export type Phase = 'betting' | 'dealing' | 'insurance' | 'playerTurns' | 'dealerTurn' | 'settled';
export type PlayerAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

/** One per player decision, for coaching & stats. */
export interface Decision {
  /** e.g. "hard-11-vs-10", "soft-18-vs-9", "pair-8-vs-A" */
  handKey: string;
  chosen: PlayerAction;
  best: PlayerAction;
  correct: boolean;
  timestamp: number;
  seatIndex: number;
  handIndex: number;
}

export interface GameState {
  rules: Rules;
  phase: Phase;
  /** Cards still in the shoe; the next card dealt is `shoe[0]`. */
  shoe: Card[];
  /** Reshuffle before the next deal once `shoe.length` is at or below this number (the cut card). */
  cutIndex: number;
  /** Number of cards in the discard tray. */
  discard: number;
  seats: Seat[];
  dealer: Card[];
  active: { seatIndex: number; handIndex: number } | null;
  /** seatIndex -> insurance bet */
  insurance: Record<number, number>;
  /** "you" seats that have answered the insurance prompt this round. */
  insuranceAnswered: number[];
  bankroll: number;
  lastDecision: Decision | null;
  /** Decisions made by "you" seats in the current round. */
  roundDecisions: Decision[];
  /** Net result of the last settled round for "you" seats, insurance included. */
  roundNet: number;
  /** True for the round that started with a fresh shoe. */
  reshuffled: boolean;
  rngSeed: number;
  /** Monotonic counter used to build unique card/hand ids. */
  nextId: number;
}

export type GameEvent =
  | { type: 'SET_SEATS'; seats: SeatType[] }
  | { type: 'SET_SEAT'; seatIndex: number; seatType: SeatType }
  | { type: 'SET_BET'; amount: number; seatIndex?: number }
  | { type: 'SET_RULES'; rules: Rules }
  | { type: 'SET_BANKROLL'; amount: number }
  | { type: 'DEAL'; now?: number }
  | { type: 'INSURANCE'; seatIndex: number; take: boolean }
  | { type: 'ACT'; action: PlayerAction; now?: number }
  | { type: 'BOT_ACT' }
  | { type: 'DEALER_STEP' }
  | { type: 'DEALER_PLAY' }
  | { type: 'NEXT_ROUND' };
