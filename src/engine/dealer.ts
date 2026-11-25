import { handTotal } from './cards';
import type { Card, Rules } from './types';

/** Dealer draws to 17; on soft 17 follows the S17/H17 rule. */
export function dealerShouldHit(cards: Card[], rules: Pick<Rules, 'dealerHitsSoft17'>): boolean {
  const { total, soft } = handTotal(cards);
  if (total < 17) return true;
  return total === 17 && soft && rules.dealerHitsSoft17;
}
