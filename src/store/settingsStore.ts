import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_BET, DEFAULT_RULES } from '../engine/game';
import type { Rules, SeatType } from '../engine/types';

export type HintMode = 'always' | 'onMistake' | 'off';
export type PracticeFocus = 'all' | 'hard' | 'soft' | 'pairs';

export interface Settings {
  rules: Rules;
  hintMode: HintMode;
  seats: SeatType[];
  bet: number;
  lastBet: number;
  fastMode: boolean;
  focus: PracticeFocus;
}

export const DEFAULT_SETTINGS: Settings = {
  rules: DEFAULT_RULES,
  hintMode: 'always',
  seats: ['empty', 'empty', 'you', 'empty', 'empty'],
  bet: DEFAULT_BET,
  lastBet: DEFAULT_BET,
  fastMode: false,
  focus: 'all',
};

interface SettingsStore extends Settings {
  setRules: (rules: Partial<Rules>) => void;
  setHintMode: (m: HintMode) => void;
  cycleSeat: (index: number) => void;
  setSeats: (seats: SeatType[]) => void;
  setBet: (bet: number) => void;
  setLastBet: (bet: number) => void;
  setFastMode: (v: boolean) => void;
  setFocus: (f: PracticeFocus) => void;
}

const NEXT_SEAT: Record<SeatType, SeatType> = { empty: 'you', you: 'bot', bot: 'empty' };

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setRules: (rules) => set((s) => ({ rules: { ...s.rules, ...rules } })),
      setHintMode: (hintMode) => set({ hintMode }),
      cycleSeat: (index) =>
        set((s) => {
          const seats = s.seats.slice();
          seats[index] = NEXT_SEAT[seats[index]];
          return { seats };
        }),
      setSeats: (seats) => set({ seats }),
      setBet: (bet) => set({ bet: Math.max(0, Math.round(bet)) }),
      setLastBet: (lastBet) => set({ lastBet }),
      setFastMode: (fastMode) => set({ fastMode }),
      setFocus: (focus) => set({ focus }),
    }),
    {
      name: 'bjt:settings:v1',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, rules: { ...DEFAULT_RULES, ...p.rules } };
      },
    },
  ),
);

export function rulesSummary(r: Rules): string {
  return [
    `${r.decks} decks`,
    r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.doubleAfterSplit ? 'DAS' : 'No DAS',
    r.lateSurrender ? 'Late surrender' : 'No surrender',
    ...(r.resplitAces ? ['RSA'] : []),
  ].join(' · ');
}
