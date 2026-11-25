import { create } from 'zustand';
import { parseHandKey, stackDrill } from '../engine/drill';
import {
  canDeal,
  createGame,
  isBotTurn,
  isDealerTurn,
  reduce,
  STARTING_BANKROLL,
} from '../engine/game';
import { randomSeed } from '../engine/rng';
import type { Decision, GameEvent, GameState, PlayerAction } from '../engine/types';
import { getBest, type BestPlay } from '../strategy/resolve';
import { UPCARDS } from '../strategy/tables';
import {
  emptyStats,
  loadStats,
  recordDecision,
  recordRound,
  saveStats,
  type Stats,
} from '../stats/stats';
import { useSettings, type PracticeFocus } from './settingsStore';

const BANKROLL_KEY = 'bjt:bankroll:v1';
export const BOT_DELAY = 600;
export const DEALER_DELAY = 500;

export interface Mistake {
  decision: Decision;
  best: BestPlay;
}

export interface Toast {
  id: number;
  kind: 'mistake' | 'info';
  text: string;
  undoable?: boolean;
}

export interface Drill {
  handKey: string;
  total: number;
  done: number;
  /** True once a drill round has been dealt (so a round already in play doesn't count). */
  dealt: boolean;
}

interface GameStore {
  game: GameState;
  stats: Stats;
  /** Snapshot from before the last "you" action, for Undo. */
  undoSnapshot: GameState | null;
  /** The best play at the moment of the last "you" action, with the decision. */
  lastCoach: Mistake | null;
  toast: Toast | null;
  /** Mistakes made in test mode during the current shoe. */
  shoeMistakes: Mistake[];
  /** Mistakes to show in the end-of-shoe review modal. */
  review: Mistake[] | null;
  drill: Drill | null;

  dispatch: (e: GameEvent) => void;
  deal: () => void;
  act: (a: PlayerAction) => void;
  insurance: (take: boolean) => void;
  nextRound: () => void;
  undo: () => void;
  dismissToast: () => void;
  closeReview: () => void;
  resetBankroll: () => void;
  resetStats: () => void;
  startDrill: (handKey: string, total?: number) => void;
  stopDrill: () => void;
  syncSettings: () => void;
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function loadBankroll(): number {
  const raw = storage()?.getItem(BANKROLL_KEY);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : STARTING_BANKROLL;
}

function saveBankroll(n: number) {
  try {
    storage()?.setItem(BANKROLL_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function initialGame(): GameState {
  const st = useSettings.getState();
  return createGame({ rules: st.rules, seats: st.seats, bet: st.bet, bankroll: loadBankroll() });
}

let timer: ReturnType<typeof setTimeout> | null = null;
let toastId = 1;

function randomFocusKey(focus: PracticeFocus, seed: number): string | null {
  if (focus === 'all') return null;
  const r = (n: number) =>
    Math.floor(((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * n);
  const up = UPCARDS[r(10)];
  if (focus === 'pairs')
    return `pair-${['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'][r(10)]}-vs-${up}`;
  if (focus === 'soft') return `soft-${13 + r(8)}-vs-${up}`;
  return `hard-${8 + r(9)}-vs-${up}`;
}

export const useGame = create<GameStore>()((set, get) => {
  /** Run bots and the dealer with delays. */
  function schedule() {
    if (timer) return;
    const g = get().game;
    const fast = useSettings.getState().fastMode;
    let delay: number | null = null;
    let event: GameEvent | null = null;
    if (isBotTurn(g)) {
      delay = fast ? 0 : BOT_DELAY;
      event = { type: 'BOT_ACT' };
    } else if (isDealerTurn(g)) {
      delay = fast ? 0 : DEALER_DELAY;
      event = { type: 'DEALER_STEP' };
    }
    if (event === null || delay === null) return;
    const e = event;
    timer = setTimeout(() => {
      timer = null;
      apply(e);
    }, delay);
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function commit(before: GameState, after: GameState, extra: Partial<GameStore> = {}) {
    const patch: Partial<GameStore> = { ...extra, game: after };
    if (before.phase !== 'settled' && after.phase === 'settled') {
      const stats = recordRound(extra.stats ?? get().stats, after.roundNet, after.bankroll);
      saveStats(storage(), stats);
      saveBankroll(after.bankroll);
      patch.stats = stats;
      const d = extra.drill ?? get().drill;
      if (d?.dealt)
        patch.drill = d.done + 1 >= d.total ? null : { ...d, done: d.done + 1, dealt: false };
    }
    if (after.phase === 'settled' || after.phase === 'betting') patch.undoSnapshot = null;
    set(patch);
    schedule();
  }

  function apply(e: GameEvent) {
    const before = get().game;
    const after = reduce(before, e);
    if (after !== before) commit(before, after);
  }

  return {
    game: initialGame(),
    stats: loadStats(storage()),
    undoSnapshot: null,
    lastCoach: null,
    toast: null,
    shoeMistakes: [],
    review: null,
    drill: null,

    dispatch: apply,

    syncSettings() {
      const g = get().game;
      if (g.phase !== 'betting') return;
      const st = useSettings.getState();
      let next = reduce(g, { type: 'SET_RULES', rules: st.rules });
      next = reduce(next, { type: 'SET_SEATS', seats: st.seats });
      next = reduce(next, { type: 'SET_BET', amount: st.bet });
      for (const seat of next.seats)
        if (seat.type === 'bot')
          next = reduce(next, { type: 'SET_BET', amount: 25, seatIndex: seat.index });
      set({ game: next });
    },

    deal() {
      get().syncSettings();
      let g = get().game;
      if (!canDeal(g)) return;
      const st = useSettings.getState();
      const patch: Partial<GameStore> = { lastCoach: null, toast: null, undoSnapshot: null };

      // End of shoe in test mode → review the mistakes.
      if (g.shoe.length <= g.cutIndex) {
        if (st.hintMode === 'off' && get().shoeMistakes.length > 0)
          patch.review = get().shoeMistakes;
        patch.shoeMistakes = [];
      }

      const drill = get().drill;
      const key = drill?.handKey ?? randomFocusKey(st.focus, randomSeed());
      const spec = key ? parseHandKey(key, randomSeed()) : null;
      if (spec) g = stackDrill(g, spec);
      if (drill) patch.drill = { ...drill, dealt: true };

      st.setLastBet(st.bet);
      const after = reduce(g, { type: 'DEAL', now: Date.now() });
      if (after.reshuffled)
        patch.toast = {
          id: toastId++,
          kind: 'info',
          text: 'New shoe — the cards were reshuffled.',
        };
      commit(g, after, patch);
    },

    act(action) {
      const g = get().game;
      const seat = g.active ? g.seats[g.active.seatIndex] : null;
      if (!seat || seat.type !== 'you') return;
      const best = getBest(g);
      const after = reduce(g, { type: 'ACT', action, now: Date.now() });
      if (after === g) return;
      const mode = useSettings.getState().hintMode;
      const decision = after.lastDecision;
      const patch: Partial<GameStore> = { undoSnapshot: mode === 'off' ? null : g };
      if (decision && best) {
        const stats = recordDecision(get().stats, decision);
        saveStats(storage(), stats);
        patch.stats = stats;
        patch.lastCoach = { decision, best };
        if (!decision.correct) {
          if (mode === 'off') patch.shoeMistakes = [...get().shoeMistakes, { decision, best }];
          else
            patch.toast = {
              id: toastId++,
              kind: 'mistake',
              text: `Not optimal — best play was ${labelOf(best.action)}`,
              undoable: true,
            };
        } else if (get().toast?.kind === 'mistake') patch.toast = null;
      }
      commit(g, after, patch);
    },

    insurance(take) {
      const g = get().game;
      if (g.phase !== 'insurance') return;
      const seat = g.seats.find((s) => s.type === 'you' && !g.insuranceAnswered.includes(s.index));
      if (!seat) return;
      if (take && useSettings.getState().hintMode !== 'off')
        set({
          toast: {
            id: toastId++,
            kind: 'mistake',
            text: 'Not optimal — basic strategy never takes insurance',
          },
        });
      apply({ type: 'INSURANCE', seatIndex: seat.index, take });
    },

    nextRound() {
      cancel();
      apply({ type: 'NEXT_ROUND' });
      set({ lastCoach: null, undoSnapshot: null });
      get().syncSettings();
    },

    undo() {
      const snap = get().undoSnapshot;
      if (!snap || useSettings.getState().hintMode === 'off') return;
      cancel();
      set({ game: snap, undoSnapshot: null, toast: null, lastCoach: null });
    },

    dismissToast: () => set({ toast: null }),
    closeReview: () => set({ review: null }),

    resetBankroll() {
      const g = get().game;
      if (g.phase !== 'betting' && g.phase !== 'settled') return;
      let next = g.phase === 'settled' ? reduce(g, { type: 'NEXT_ROUND' }) : g;
      next = reduce(next, { type: 'SET_BANKROLL', amount: STARTING_BANKROLL });
      saveBankroll(STARTING_BANKROLL);
      set({ game: next });
    },

    resetStats() {
      const stats = emptyStats();
      saveStats(storage(), stats);
      set({ stats });
    },

    startDrill(handKey, total = 10) {
      set({ drill: { handKey, total, done: 0, dealt: false } });
    },
    stopDrill: () => set({ drill: null }),
  };
});

function labelOf(a: PlayerAction) {
  return a.charAt(0).toUpperCase() + a.slice(1);
}

// Keep the table in sync with settings while betting.
useSettings.subscribe(() => useGame.getState().syncSettings());
