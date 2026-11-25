import { getBest } from '../strategy/resolve';
import type { GameState, PlayerAction } from './types';

/** Bots always play perfect basic strategy. */
export function botAction(state: GameState): PlayerAction | null {
  return getBest(state)?.action ?? null;
}
