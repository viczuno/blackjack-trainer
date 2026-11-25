import { mulberry32 } from './rng';
import { newShoe, SUITS } from './shoe';
import type { Card, GameState, Rank } from './types';
import { occupiedSeats } from './game';

const TEN_RANKS: Rank[] = ['10', 'J', 'Q', 'K'];

export interface DrillSpec {
  player: [Rank, Rank];
  upcard: Rank;
}

function rankForValue(v: number, rnd: () => number): Rank {
  if (v === 11 || v === 1) return 'A';
  if (v === 10) return TEN_RANKS[Math.floor(rnd() * 4)];
  return String(v) as Rank;
}

/** Turn a stats key ("hard-11-vs-10", "soft-18-vs-9", "pair-8-vs-A") into two player cards and an up card. */
export function parseHandKey(key: string, seed = 1): DrillSpec | null {
  const m = /^(hard|soft|pair)-(\w+)-vs-(\w+)$/.exec(key);
  if (!m) return null;
  const rng = mulberry32(seed);
  const rnd = () => rng.next();
  const [, kind, what, up] = m;
  const upcard = up === 'A' ? 'A' : rankForValue(Number(up), rnd);
  if (kind === 'pair') {
    const v = what === 'A' ? 11 : Number(what);
    return { player: [rankForValue(v, rnd), rankForValue(v, rnd)], upcard };
  }
  const total = Number(what);
  if (kind === 'soft') {
    if (total === 12) return { player: ['A', 'A'], upcard };
    const other = total - 11;
    if (other < 2 || other > 9) return null;
    return { player: ['A', rankForValue(other, rnd)], upcard };
  }
  // Hard: two different values from 2–10 that add up to the total.
  const options: [number, number][] = [];
  for (let a = 2; a <= 10; a++) {
    const b = total - a;
    if (b >= 2 && b <= 10 && a < b) options.push([a, b]);
  }
  if (options.length === 0) {
    if (total === 4) return { player: ['2', '2'], upcard };
    if (total === 20) return { player: ['10', 'K'], upcard };
    return null;
  }
  const [a, b] = options[Math.floor(rnd() * options.length)];
  return { player: [rankForValue(a, rnd), rankForValue(b, rnd)], upcard };
}

function takeCard(shoe: Card[], rank: Rank, rnd: () => number): Card {
  const idx = shoe.findIndex((c) => c.rank === rank);
  if (idx >= 0) return shoe.splice(idx, 1)[0];
  const suit = SUITS[Math.floor(rnd() * 4)];
  return { rank, suit, id: `drill-${rank}${suit}-${Math.floor(rnd() * 1e9)}` };
}

/**
 * Stack the shoe so the first "you" hand gets the drill situation. Other seats get random cards
 * and the dealer's hole card never makes a blackjack (so the drill is always played).
 */
export function stackDrill(state: GameState, spec: DrillSpec): GameState {
  const rng = mulberry32(state.rngSeed ^ 0x9e3779b9);
  const rnd = () => rng.next();
  let base = state;
  if (state.shoe.length <= state.cutIndex + 30) {
    // Reshuffle now so the deal itself doesn't reshuffle away the stacked cards.
    const fresh = newShoe(state.rules.decks, state.rngSeed);
    base = {
      ...state,
      shoe: fresh.shoe,
      cutIndex: fresh.cutIndex,
      rngSeed: fresh.seed,
      discard: 0,
    };
  }
  const shoe = base.shoe.slice();
  const seats = occupiedSeats(base);
  const youPos = seats.findIndex((s) => s.type === 'you');
  if (youPos < 0) return state;

  const random = () => shoe.splice(Math.floor(rnd() * shoe.length), 1)[0];
  const first: Card[] = seats.map((_, i) =>
    i === youPos ? takeCard(shoe, spec.player[0], rnd) : random(),
  );
  const up = takeCard(shoe, spec.upcard, rnd);
  const second: Card[] = seats.map((_, i) =>
    i === youPos ? takeCard(shoe, spec.player[1], rnd) : random(),
  );
  const holeRank: Rank =
    spec.upcard === 'A' ? '7' : TEN_RANKS.includes(spec.upcard) ? '8' : (shoe[0]?.rank ?? '5');
  const hole = takeCard(shoe, holeRank, rnd);

  return { ...base, shoe: [...first, up, ...second, hole, ...shoe] };
}
