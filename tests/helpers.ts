import { createGame, withShoe, type CreateGameOptions } from '../src/engine/game';
import { card } from '../src/engine/shoe';
import type { GameState } from '../src/engine/types';

/** Cards given as "A 10 5 K ..." in deal order, followed by filler 2s. */
export function stacked(order: string, opts: CreateGameOptions = {}): GameState {
  const cards = order
    .trim()
    .split(/\s+/)
    .map((c, i) => card(c, `t${i}`));
  const filler = Array.from({ length: 60 }, (_, i) => card('2', `f${i}`));
  return withShoe(createGame({ seed: 1, ...opts }), [...cards, ...filler]);
}
