import { describe, expect, test } from 'vitest';
import { card } from '../src/engine/shoe';
import type { Rank, Rules } from '../src/engine/types';
import { DEFAULT_RULES } from '../src/engine/game';
import { explain, INSURANCE_EXPLANATION } from '../src/strategy/explain';
import { getChartCode } from '../src/strategy/lookup';
import { resolveAction } from '../src/strategy/resolve';
import { getDisplayTable, getTable, UPCARDS, type ChartKind } from '../src/strategy/tables';

// Independent copies of the charts from the plan (section 3), written out in full.
const S17 = {
  hard: `
5-8 : H  H  H  H  H  H  H  H  H  H
9   : H  D  D  D  D  H  H  H  H  H
10  : D  D  D  D  D  D  D  D  H  H
11  : D  D  D  D  D  D  D  D  D  H
12  : H  H  S  S  S  H  H  H  H  H
13  : S  S  S  S  S  H  H  H  H  H
14  : S  S  S  S  S  H  H  H  H  H
15  : S  S  S  S  S  H  H  H  Rh H
16  : S  S  S  S  S  H  H  Rh Rh Rh
17+ : S  S  S  S  S  S  S  S  S  S`,
  soft: `
A,2 : H  H  H  D  D  H  H  H  H  H
A,3 : H  H  H  D  D  H  H  H  H  H
A,4 : H  H  D  D  D  H  H  H  H  H
A,5 : H  H  D  D  D  H  H  H  H  H
A,6 : H  D  D  D  D  H  H  H  H  H
A,7 : S  Ds Ds Ds Ds S  S  H  H  H
A,8 : S  S  S  S  S  S  S  S  S  S
A,9 : S  S  S  S  S  S  S  S  S  S`,
  pairs: `
2,2   : Ph Ph P  P  P  P  H  H  H  H
3,3   : Ph Ph P  P  P  P  H  H  H  H
4,4   : H  H  H  Ph Ph H  H  H  H  H
5,5   : D  D  D  D  D  D  D  D  H  H
6,6   : Ph P  P  P  P  H  H  H  H  H
7,7   : P  P  P  P  P  P  H  H  H  H
8,8   : P  P  P  P  P  P  P  P  P  P
9,9   : P  P  P  P  P  S  P  P  S  S
10,10 : S  S  S  S  S  S  S  S  S  S
A,A   : P  P  P  P  P  P  P  P  P  P`,
};

const H17 = {
  hard: `
5-8 : H  H  H  H  H  H  H  H  H  H
9   : H  D  D  D  D  H  H  H  H  H
10  : D  D  D  D  D  D  D  D  H  H
11  : D  D  D  D  D  D  D  D  D  D
12  : H  H  S  S  S  H  H  H  H  H
13  : S  S  S  S  S  H  H  H  H  H
14  : S  S  S  S  S  H  H  H  H  H
15  : S  S  S  S  S  H  H  H  Rh Rh
16  : S  S  S  S  S  H  H  Rh Rh Rh
17+ : S  S  S  S  S  S  S  S  S  Rs`,
  soft: `
A,2 : H  H  H  D  D  H  H  H  H  H
A,3 : H  H  H  D  D  H  H  H  H  H
A,4 : H  H  D  D  D  H  H  H  H  H
A,5 : H  H  D  D  D  H  H  H  H  H
A,6 : H  D  D  D  D  H  H  H  H  H
A,7 : Ds Ds Ds Ds Ds S  S  H  H  H
A,8 : S  S  S  S  Ds S  S  S  S  S
A,9 : S  S  S  S  S  S  S  S  S  S`,
  pairs: `
2,2   : Ph Ph P  P  P  P  H  H  H  H
3,3   : Ph Ph P  P  P  P  H  H  H  H
4,4   : H  H  H  Ph Ph H  H  H  H  H
5,5   : D  D  D  D  D  D  D  D  H  H
6,6   : Ph P  P  P  P  H  H  H  H  H
7,7   : P  P  P  P  P  P  H  H  H  H
8,8   : P  P  P  P  P  P  P  P  P  Rp
9,9   : P  P  P  P  P  S  P  P  S  S
10,10 : S  S  S  S  S  S  S  S  S  S
A,A   : P  P  P  P  P  P  P  P  P  P`,
};

function parse(spec: string) {
  return spec
    .trim()
    .split('\n')
    .map((l) => {
      const [k, v] = l.split(':');
      return { key: k.trim(), codes: v.trim().split(/\s+/) };
    });
}

/** Two cards that represent a chart row. */
function cardsFor(kind: ChartKind, key: string) {
  if (kind === 'pairs') {
    const r = key.split(',')[0] as Rank;
    return [card(r), card(r)];
  }
  if (kind === 'soft') return [card('A'), card(key.split(',')[1])];
  const hard: Record<string, [string, string]> = {
    '5-8': ['5', '3'],
    '9': ['5', '4'],
    '10': ['6', '4'],
    '11': ['7', '4'],
    '12': ['10', '2'],
    '13': ['10', '3'],
    '14': ['10', '4'],
    '15': ['10', '5'],
    '16': ['10', '6'],
    '17+': ['10', '7'],
  };
  return hard[key].map((r) => card(r));
}

const UP_RANK: Record<string, Rank> = { '10': 'K' };

for (const [name, expected, h17] of [
  ['S17', S17, false],
  ['H17', H17, true],
] as const) {
  describe(`basic strategy ${name}: all 280 cells`, () => {
    const rules = { dealerHitsSoft17: h17 };
    let cells = 0;
    for (const kind of ['hard', 'soft', 'pairs'] as const) {
      const exp = parse(expected[kind]);
      const table = getTable(kind, rules);
      test(`${kind} table has the expected rows`, () => {
        expect(table.map((r) => r.key)).toEqual(exp.map((r) => r.key));
      });
      for (const row of exp) {
        UPCARDS.forEach((up, i) => {
          cells++;
          test(`${kind} ${row.key} vs ${up} = ${row.codes[i]}`, () => {
            const t = table.find((r) => r.key === row.key)!;
            expect(t.codes[i]).toBe(row.codes[i]);
            // End-to-end: real cards through the lookup give the same code.
            const l = getChartCode(
              cardsFor(kind, row.key),
              UP_RANK[up] ?? (up as Rank),
              rules,
              true,
            );
            expect(l.code).toBe(row.codes[i]);
            expect(l.cell).toEqual({ table: kind, row: row.key, upcard: up });
          });
        });
      }
    }
    test('covers 280 cells', () => expect(cells).toBe(280));
  });
}

describe('fallbacks (section 3.3)', () => {
  const rules: Rules = { ...DEFAULT_RULES };
  test('3-card 11 vs 6 → Hit', () => {
    const l = getChartCode([card('2'), card('4'), card('5')], '6', rules, false);
    expect(l.code).toBe('D');
    expect(resolveAction(l.code, ['hit', 'stand'], rules)).toBe('hit');
  });
  test('A,7 (3 cards) vs 4 → Stand', () => {
    const l = getChartCode([card('A'), card('3'), card('4')], '4', rules, false);
    expect(l.kind).toBe('soft');
    expect(l.total).toBe(18);
    expect(resolveAction(l.code, ['hit', 'stand'], rules)).toBe('stand');
  });
  test('16 vs 10 after a split → Hit', () => {
    const l = getChartCode([card('10'), card('6')], 'Q', rules, false);
    expect(l.code).toBe('Rh');
    expect(resolveAction(l.code, ['hit', 'stand', 'double'], rules)).toBe('hit');
  });
  test('8,8 vs A with H17 and surrender off → Split', () => {
    const l = getChartCode([card('8'), card('8')], 'A', { dealerHitsSoft17: true }, true);
    expect(l.code).toBe('Rp');
    expect(resolveAction(l.code, ['hit', 'stand', 'double', 'split'], rules)).toBe('split');
  });
  test('Ph without DAS → Hit; with DAS → Split', () => {
    const avail = ['hit', 'stand', 'double', 'split'] as const;
    expect(resolveAction('Ph', [...avail], { doubleAfterSplit: false })).toBe('hit');
    expect(resolveAction('Ph', [...avail], { doubleAfterSplit: true })).toBe('split');
  });
  test('surrender available → Rh/Rs surrender', () => {
    const avail = ['hit', 'stand', 'double', 'surrender'] as const;
    expect(resolveAction('Rh', [...avail], rules)).toBe('surrender');
    expect(resolveAction('Rs', [...avail], rules)).toBe('surrender');
    expect(resolveAction('Rs', ['hit', 'stand'], rules)).toBe('stand');
  });
  test('unsplittable A,A = soft 12 → Hit', () => {
    const l = getChartCode([card('A'), card('A')], '6', rules, false);
    expect(l.kind).toBe('soft');
    expect(l.total).toBe(12);
    expect(l.code).toBe('H');
  });
  test('unsplittable 8,8 uses hard 16', () => {
    const l = getChartCode([card('8'), card('8')], '6', rules, false);
    expect(l.kind).toBe('hard');
    expect(l.code).toBe('S');
  });
  test('hard 4 uses the 5–8 row, 21 stands', () => {
    expect(getChartCode([card('2'), card('2')], '6', rules, false).cell?.row).toBe('5-8');
    expect(getChartCode([card('10'), card('5'), card('6')], '6', rules, false).code).toBe('S');
    expect(getChartCode([card('A'), card('5'), card('5')], '6', rules, false).code).toBe('S');
  });
  test('hand keys', () => {
    expect(getChartCode([card('7'), card('4')], 'K', rules, false).handKey).toBe('hard-11-vs-10');
    expect(getChartCode([card('A'), card('7')], '9', rules, false).handKey).toBe('soft-18-vs-9');
    expect(getChartCode([card('8'), card('8')], 'A', rules, true).handKey).toBe('pair-8-vs-A');
  });
});

describe('display table', () => {
  test('surrender off drops R codes, DAS resolves Ph', () => {
    const r: Rules = { ...DEFAULT_RULES, lateSurrender: false, doubleAfterSplit: false };
    const hard = getDisplayTable('hard', r);
    expect(hard.find((x) => x.key === '16')!.codes[8]).toBe('H');
    const pairs = getDisplayTable('pairs', r);
    expect(pairs.find((x) => x.key === '2,2')!.codes[0]).toBe('H');
    const das = getDisplayTable('pairs', DEFAULT_RULES);
    expect(das.find((x) => x.key === '2,2')!.codes[0]).toBe('P');
  });
});

describe('explanations', () => {
  test('templates from the plan', () => {
    expect(explain({ kind: 'hard', total: 11, upcard: '6', code: 'D' }, 'double')).toMatch(
      /Double against every up card except an Ace/,
    );
    expect(
      explain({ kind: 'pair', total: 16, pairRank: '8', upcard: '10', code: 'P' }, 'split'),
    ).toMatch(/worst total/);
    expect(
      explain({ kind: 'pair', total: 12, pairRank: 'A', upcard: '10', code: 'P' }, 'split'),
    ).toMatch(/Always split Aces/);
    expect(
      explain({ kind: 'pair', total: 20, pairRank: '10', upcard: '6', code: 'S' }, 'stand'),
    ).toMatch(/Never split tens/);
    expect(explain({ kind: 'soft', total: 18, upcard: '9', code: 'H' }, 'hit')).toMatch(/Soft 18/);
    expect(explain({ kind: 'hard', total: 14, upcard: '4', code: 'S' }, 'stand')).toMatch(
      /likely to bust/,
    );
    expect(explain({ kind: 'hard', total: 14, upcard: '9', code: 'H' }, 'hit')).toMatch(
      /17 or more/,
    );
    expect(INSURANCE_EXPLANATION).toMatch(/never takes it/);
  });
  test('every cell gets a sentence', () => {
    for (const h17 of [false, true]) {
      for (const kind of ['hard', 'soft', 'pairs'] as const) {
        for (const row of getTable(kind, { dealerHitsSoft17: h17 })) {
          UPCARDS.forEach((up) => {
            const l = getChartCode(
              cardsFor(kind, row.key),
              UP_RANK[up] ?? (up as Rank),
              { dealerHitsSoft17: h17 },
              true,
            );
            for (const a of ['hit', 'stand', 'double', 'split', 'surrender'] as const) {
              expect(explain(l, a).length).toBeGreaterThan(10);
            }
          });
        }
      }
    }
  });
});
