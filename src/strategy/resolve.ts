import { activeHand, availableActions, dealerUpcard } from '../engine/cards';
import type { GameState, PlayerAction, Rules } from '../engine/types';
import { explain } from './explain';
import { getChartCode, type ChartLookup } from './lookup';
import type { ChartCode } from './tables';

/** Turn a chart code into a concrete action given what is allowed right now (section 3.3). */
export function resolveAction(
  code: ChartCode,
  available: PlayerAction[],
  rules: Pick<Rules, 'doubleAfterSplit'>,
): PlayerAction {
  const can = (a: PlayerAction) => available.includes(a);
  const pick = (a: PlayerAction, fallback: PlayerAction): PlayerAction =>
    can(a) ? a : can(fallback) ? fallback : (available[0] ?? 'stand');
  switch (code) {
    case 'H':
      return pick('hit', 'stand');
    case 'S':
      return 'stand';
    case 'D':
      return pick('double', 'hit');
    case 'Ds':
      return pick('double', 'stand');
    case 'P':
      return pick('split', 'hit');
    case 'Ph':
      return rules.doubleAfterSplit ? pick('split', 'hit') : pick('hit', 'stand');
    case 'Rh':
      return pick('surrender', 'hit');
    case 'Rs':
      return pick('surrender', 'stand');
    case 'Rp':
      return pick('surrender', 'split');
  }
}

export interface BestPlay {
  action: PlayerAction;
  lookup: ChartLookup;
  explanation: string;
  available: PlayerAction[];
}

/** Best basic-strategy play for the active hand, or null when nothing is being played. */
export function getBest(state: GameState): BestPlay | null {
  const hand = activeHand(state);
  const up = dealerUpcard(state);
  const available = availableActions(state);
  if (!hand || !up || available.length === 0) return null;
  const lookup = getChartCode(hand.cards, up.rank, state.rules, available.includes('split'));
  const action = resolveAction(lookup.code, available, state.rules);
  return { action, lookup, explanation: explain(lookup, action), available };
}
