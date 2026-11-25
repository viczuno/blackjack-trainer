import clsx from 'clsx';
import styles from './Controls.module.css';

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
}

export function Switch({ checked, onChange, label, disabled, hideLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={clsx(styles.switch, checked && styles.on)}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className={styles.track} aria-hidden />
      {hideLabel ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
