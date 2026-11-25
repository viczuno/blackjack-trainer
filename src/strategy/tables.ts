import type { Rules } from '../engine/types';

/** Chart codes, see plan section 3. */
export type ChartCode = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Ph' | 'Rh' | 'Rs' | 'Rp';
export type ChartKind = 'hard' | 'soft' | 'pairs';
export type Upcard = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'A';
export const UPCARDS: Upcard[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

export interface ChartRow {
  /** Stable key, e.g. "11", "5-8", "17+", "A,7", "8,8". */
  key: string;
  label: string;
  codes: ChartCode[];
}

function rows(spec: string): ChartRow[] {
  return spec
    .trim()
    .split('\n')
    .map((line) => {
      const [label, cells] = line.split(':');
      const key = label.trim();
      const codes = cells.trim().split(/\s+/) as ChartCode[];
      if (codes.length !== 10) throw new Error(`Row ${key} must have 10 cells`);
      return { key, label: key.replace('-', '–'), codes };
    });
}

/** Base table: 4–8 decks, S17, DAS on, late surrender on. */
export const HARD = rows(`
5-8 : H  H  H  H  H  H  H  H  H  H
9   : H  D  D  D  D  H  H  H  H  H
10  : D  D  D  D  D  D  D  D  H  H
11  : D  D  D  D  D  D  D  D  D  H
12  : H  H  S  S  S  H  H  H  H  H
13  : S  S  S  S  S  H  H  H  H  H
14  : S  S  S  S  S  H  H  H  H  H
15  : S  S  S  S  S  H  H  H  Rh H
16  : S  S  S  S  S  H  H  Rh Rh Rh
17+ : S  S  S  S  S  S  S  S  S  S
`);

export const SOFT = rows(`
A,2 : H  H  H  D  D  H  H  H  H  H
A,3 : H  H  H  D  D  H  H  H  H  H
A,4 : H  H  D  D  D  H  H  H  H  H
A,5 : H  H  D  D  D  H  H  H  H  H
A,6 : H  D  D  D  D  H  H  H  H  H
A,7 : S  Ds Ds Ds Ds S  S  H  H  H
A,8 : S  S  S  S  S  S  S  S  S  S
A,9 : S  S  S  S  S  S  S  S  S  S
`);

export const PAIRS = rows(`
2,2   : Ph Ph P  P  P  P  H  H  H  H
3,3   : Ph Ph P  P  P  P  H  H  H  H
4,4   : H  H  H  Ph Ph H  H  H  H  H
5,5   : D  D  D  D  D  D  D  D  H  H
6,6   : Ph P  P  P  P  H  H  H  H  H
7,7   : P  P  P  P  P  P  H  H  H  H
8,8   : P  P  P  P  P  P  P  P  P  P
9,9   : P  P  P  P  P  S  P  P  S  S
10,10 : S  S  S  S  S  S  S  S  S  S
A,A   : P  P  P  P  P  P  P  P  P  P
`);

/** Cells that change when the dealer hits soft 17 (section 3.2). */
export const H17_CHANGES: { kind: ChartKind; row: string; upcard: Upcard; code: ChartCode }[] = [
  { kind: 'hard', row: '11', upcard: 'A', code: 'D' },
  { kind: 'hard', row: '15', upcard: 'A', code: 'Rh' },
  { kind: 'hard', row: '17+', upcard: 'A', code: 'Rs' },
  { kind: 'soft', row: 'A,7', upcard: '2', code: 'Ds' },
  { kind: 'soft', row: 'A,8', upcard: '6', code: 'Ds' },
  { kind: 'pairs', row: '8,8', upcard: 'A', code: 'Rp' },
];

const BASE: Record<ChartKind, ChartRow[]> = { hard: HARD, soft: SOFT, pairs: PAIRS };

/** The raw chart (with R/Ph codes) for the dealer's soft-17 rule. */
export function getTable(kind: ChartKind, rules: Pick<Rules, 'dealerHitsSoft17'>): ChartRow[] {
  const table = BASE[kind].map((r) => ({ ...r, codes: r.codes.slice() }));
  if (rules.dealerHitsSoft17) {
    for (const c of H17_CHANGES) {
      if (c.kind !== kind) continue;
      const row = table.find((r) => r.key === c.row)!;
      row.codes[UPCARDS.indexOf(c.upcard)] = c.code;
    }
  }
  return table;
}

/** The chart as it should be displayed for these rules: R codes drop when surrender is off, Ph resolves by DAS. */
export function displayCode(code: ChartCode, rules: Rules): ChartCode {
  if (!rules.lateSurrender) {
    if (code === 'Rh') return 'H';
    if (code === 'Rs') return 'S';
    if (code === 'Rp') return 'P';
  }
  if (code === 'Ph') return rules.doubleAfterSplit ? 'P' : 'H';
  return code;
}

export function getDisplayTable(kind: ChartKind, rules: Rules): ChartRow[] {
  return getTable(kind, rules).map((r) => ({
    ...r,
    codes: r.codes.map((c) => displayCode(c, rules)),
  }));
}

export const CODE_NAMES: Record<ChartCode, string> = {
  H: 'Hit',
  S: 'Stand',
  D: 'Double, else hit',
  Ds: 'Double, else stand',
  P: 'Split',
  Ph: 'Split if DAS, else hit',
  Rh: 'Surrender, else hit',
  Rs: 'Surrender, else stand',
  Rp: 'Surrender, else split',
};
