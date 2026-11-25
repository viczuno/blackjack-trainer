import { mulberry32 } from './rng';
import type { Card, Rank, Suit } from './types';

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
/** Reshuffle once 75% of the shoe has been dealt. */
export const PENETRATION = 0.75;

export function buildDecks(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit, id: `d${d}-${rank}${suit}` });
    }
  }
  return cards;
}

/** Fisher–Yates shuffle with a seeded RNG. Returns a new array and the advanced seed. */
export function shuffle<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const rng = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, seed: rng.seed() };
}

export function newShoe(
  decks: number,
  seed: number,
): { shoe: Card[]; cutIndex: number; seed: number } {
  const { items, seed: next } = shuffle(buildDecks(decks), seed);
  return { shoe: items, cutIndex: Math.round(items.length * (1 - PENETRATION)), seed: next };
}

/** Parse a compact card spec such as "A♠", "10h", "K" (suit defaults to ♠). */
export function card(spec: string, id?: string): Card {
  const m = /^(10|[2-9AJQK])([♠♥♦♣shdc])?$/i.exec(spec.trim());
  if (!m) throw new Error(`Bad card spec: ${spec}`);
  const rank = m[1].toUpperCase() as Rank;
  const suitMap: Record<string, Suit> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const raw = m[2] ?? '♠';
  const suit = (suitMap[raw.toLowerCase()] ?? raw) as Suit;
  return { rank, suit, id: id ?? `x-${spec}-${Math.random().toString(36).slice(2, 8)}` };
}
