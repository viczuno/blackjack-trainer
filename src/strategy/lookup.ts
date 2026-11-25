import { handTotal, isPair, rankLabel } from '../engine/cards';
import type { Card, Rank, Rules } from '../engine/types';
import { getTable, UPCARDS, type ChartCode, type ChartKind, type Upcard } from './tables';

export type HandKind = 'hard' | 'soft' | 'pair';

export interface ChartLookup {
  /** The hand classification used for the lookup. */
  kind: HandKind;
  total: number;
  /** Pair rank label ("8", "10", "A") when kind = pair. */
  pairRank?: string;
  upcard: Upcard;
  code: ChartCode;
  /** Which chart cell to highlight, or null when no cell applies (e.g. soft 12 from unsplittable A,A). */
  cell: { table: ChartKind; row: string; upcard: Upcard } | null;
  /** Stats key, e.g. "hard-11-vs-10", "soft-18-vs-9", "pair-8-vs-A". */
  handKey: string;
}

export function upcardOf(rank: Rank): Upcard {
  return rankLabel(rank) as Upcard;
}

function hardRowKey(total: number): string {
  if (total <= 8) return '5-8';
  if (total >= 17) return '17+';
  return String(total);
}

/**
 * Look up the chart code for a hand. `canSplit` decides whether the pair table applies:
 * pair table (pair and splittable) → soft table → hard table.
 */
export function getChartCode(
  cards: Card[],
  upRank: Rank,
  rules: Pick<Rules, 'dealerHitsSoft17'>,
  canSplit: boolean,
): ChartLookup {
  const upcard = upcardOf(upRank);
  const col = UPCARDS.indexOf(upcard);
  const { total, soft } = handTotal(cards);

  if (isPair(cards) && canSplit) {
    const label = rankLabel(cards[0].rank);
    const row = `${label},${label}`;
    const code = getTable('pairs', rules).find((r) => r.key === row)!.codes[col];
    return {
      kind: 'pair',
      total,
      pairRank: label,
      upcard,
      code,
      cell: { table: 'pairs', row, upcard },
      handKey: `pair-${label}-vs-${upcard}`,
    };
  }

  if (soft) {
    const handKey = `soft-${total}-vs-${upcard}`;
    if (total >= 21) return { kind: 'soft', total, upcard, code: 'S', cell: null, handKey };
    if (total <= 12) return { kind: 'soft', total, upcard, code: 'H', cell: null, handKey };
    const row = `A,${total - 11}`;
    const code = getTable('soft', rules).find((r) => r.key === row)!.codes[col];
    return { kind: 'soft', total, upcard, code, cell: { table: 'soft', row, upcard }, handKey };
  }

  const handKey = `hard-${total}-vs-${upcard}`;
  if (total >= 21) return { kind: 'hard', total, upcard, code: 'S', cell: null, handKey };
  const row = hardRowKey(total);
  const code = getTable('hard', rules).find((r) => r.key === row)!.codes[col];
  return { kind: 'hard', total, upcard, code, cell: { table: 'hard', row, upcard }, handKey };
}
