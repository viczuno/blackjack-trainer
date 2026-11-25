import type { Card, GameState, Hand, PlayerAction, Rank } from './types';

export function value(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** Total of the visible cards. `soft` is true when an ace still counts as 11. */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.faceDown) continue;
    total += value(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isPair(cards: Card[]): boolean {
  return cards.length === 2 && value(cards[0].rank) === value(cards[1].rank);
}

export function isBlackjack(hand: Pick<Hand, 'cards' | 'isSplitHand'>): boolean {
  return !hand.isSplitHand && hand.cards.length === 2 && handTotal(hand.cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards).total > 21;
}

/** Rank label used for pairs and up cards: 10/J/Q/K all map to "10". */
export function rankLabel(rank: Rank): string {
  return value(rank) === 10 ? '10' : rank;
}

export function activeHand(state: GameState): Hand | null {
  if (!state.active) return null;
  return state.seats[state.active.seatIndex]?.hands[state.active.handIndex] ?? null;
}

export function dealerUpcard(state: GameState): Card | null {
  return state.dealer[0] ?? null;
}

/** Actions the active hand may take right now (section 2 of the plan). */
export function availableActions(state: GameState): PlayerAction[] {
  if (state.phase !== 'playerTurns' || !state.active) return [];
  const seat = state.seats[state.active.seatIndex];
  const hand = activeHand(state);
  if (!seat || !hand || hand.status !== 'active') return [];
  const isYou = seat.type === 'you';
  const canAfford = !isYou || state.bankroll >= hand.bet;
  const twoCards = hand.cards.length === 2;
  const roomToSplit = seat.hands.length < state.rules.maxHandsPerSeat;
  const out: PlayerAction[] = [];

  if (hand.isSplitAces) {
    // Split aces take no further cards. They may only re-split when allowed.
    if (twoCards && isPair(hand.cards) && state.rules.resplitAces && roomToSplit && canAfford)
      out.push('split');
    out.push('stand');
    return out;
  }

  out.push('hit', 'stand');
  if (twoCards && (!hand.isSplitHand || state.rules.doubleAfterSplit) && canAfford)
    out.push('double');
  if (twoCards && isPair(hand.cards) && roomToSplit && canAfford) out.push('split');
  if (state.rules.lateSurrender && twoCards && !hand.isSplitHand && seat.hands.length === 1)
    out.push('surrender');
  return out;
}

/** Why an action is disabled, for button tooltips. */
export function disabledReason(state: GameState, action: PlayerAction): string | null {
  const hand = activeHand(state);
  if (!hand || state.phase !== 'playerTurns') return 'Not your turn';
  if (availableActions(state).includes(action)) return null;
  const seat = state.seats[hand.seatIndex];
  const poor = seat.type === 'you' && state.bankroll < hand.bet;
  switch (action) {
    case 'hit':
      return hand.isSplitAces ? 'Split aces get one card' : 'Not allowed';
    case 'stand':
      return 'Not allowed';
    case 'double':
      if (hand.isSplitAces) return 'Split aces get one card';
      if (hand.cards.length !== 2) return 'Only on first two cards';
      if (hand.isSplitHand && !state.rules.doubleAfterSplit) return 'No double after split';
      return poor ? 'Not enough bankroll' : 'Not allowed';
    case 'split':
      if (!isPair(hand.cards)) return 'Not a pair';
      if (seat.hands.length >= state.rules.maxHandsPerSeat) return 'Max hands reached';
      if (hand.isSplitAces) return 'No re-splitting aces';
      return poor ? 'Not enough bankroll' : 'Not allowed';
    case 'surrender':
      if (!state.rules.lateSurrender) return 'Surrender is off';
      if (hand.isSplitHand) return 'Not after a split';
      return 'Only as first decision';
  }
}
