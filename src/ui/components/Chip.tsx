import clsx from 'clsx';
import type { CSSProperties } from 'react';
import styles from './Chip.module.css';

const cls = (v: number) =>
  v >= 500 ? styles.v500 : v >= 100 ? styles.v100 : v >= 25 ? styles.v25 : styles.v5;

interface Props {
  value: number;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  style?: CSSProperties;
}

export function Chip({ value, size = 44, onClick, disabled, label, style }: Props) {
  const s = { '--size': `${size}px`, ...style } as CSSProperties;
  if (onClick)
    return (
      <button
        type="button"
        className={clsx(styles.chip, cls(value))}
        style={s}
        onClick={onClick}
        disabled={disabled}
        aria-label={label ?? `Add $${value}`}
      >
        {value}
      </button>
    );
  return (
    <span className={clsx(styles.chip, cls(value))} style={s} aria-hidden>
      {value}
    </span>
  );
}

/** Break an amount into chip denominations, largest first (at most 5 chips). */
export function chipStack(amount: number): number[] {
  const out: number[] = [];
  let left = amount;
  for (const v of [500, 100, 25, 5]) {
    while (left >= v && out.length < 5) {
      out.push(v);
      left -= v;
    }
  }
  if (out.length === 0 && amount > 0) out.push(5);
  return out;
}
