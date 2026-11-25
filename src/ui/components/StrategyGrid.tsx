import clsx from 'clsx';
import type { Rules } from '../../engine/types';
import { ACTION_LABEL } from '../../strategy/explain';
import {
  CODE_NAMES,
  getDisplayTable,
  UPCARDS,
  type ChartCode,
  type ChartKind,
} from '../../strategy/tables';
import styles from './Panels.module.css';

interface Props {
  kind: ChartKind;
  rules: Rules;
  highlight?: { row: string; upcard: string } | null;
  size?: 'sm' | 'lg';
}

const KIND_NAME: Record<ChartKind, string> = { hard: 'Hard', soft: 'Soft', pairs: 'Pair' };

const cellCls = (c: ChartCode) => styles[`c${c}`];

export function StrategyGrid({ kind, rules, highlight, size = 'sm' }: Props) {
  const rows = getDisplayTable(kind, rules);
  const hasHl = !!highlight && rows.some((r) => r.key === highlight.row);
  return (
    <table
      className={clsx(styles.grid, size === 'lg' && styles.lg)}
      aria-label={`${KIND_NAME[kind]} totals strategy`}
    >
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Hand</span>
          </th>
          {UPCARDS.map((u) => (
            <th
              key={u}
              scope="col"
              className={clsx(
                hasHl && highlight!.upcard !== u && styles.dim,
                hasHl && highlight!.upcard === u && styles.hot,
              )}
            >
              {u}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const rowHot = hasHl && highlight!.row === r.key;
          return (
            <tr key={r.key}>
              <th
                scope="row"
                className={clsx(hasHl && !rowHot && styles.dim, rowHot && styles.hot)}
              >
                {r.label}
              </th>
              {r.codes.map((c, i) => {
                const col = UPCARDS[i];
                const colHot = hasHl && highlight!.upcard === col;
                const target = rowHot && colHot;
                return (
                  <td
                    key={col}
                    className={clsx(
                      cellCls(c),
                      hasHl && !rowHot && !colHot && styles.dim,
                      target && styles.target,
                    )}
                    aria-label={`${KIND_NAME[kind]} ${r.label} versus ${col}: ${CODE_NAMES[c]}`}
                    aria-current={target ? 'true' : undefined}
                    data-target={target ? 'true' : undefined}
                  >
                    {c}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Legend() {
  const items: [ChartCode, string][] = [
    ['H', ACTION_LABEL.hit],
    ['S', ACTION_LABEL.stand],
    ['D', 'Double, else hit'],
    ['Ds', 'Double, else stand'],
    ['P', ACTION_LABEL.split],
    ['Rh', 'Surrender, else hit'],
    ['Rs', 'Surrender, else stand'],
    ['Rp', 'Surrender, else split'],
  ];
  return (
    <div className={styles.legend}>
      {items.map(([c, label]) => (
        <span key={c}>
          <i className={cellCls(c)}>{c}</i>
          {label}
        </span>
      ))}
    </div>
  );
}
