const whole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $1,000 or $37.50; negatives use a real minus sign. */
export function money(n: number): string {
  const abs = Math.abs(n);
  const s = Number.isInteger(abs) ? whole.format(abs) : cents.format(abs);
  return n < 0 ? `−${s}` : s;
}

export function signedMoney(n: number): string {
  if (n === 0) return '$0';
  return n > 0 ? `+${money(n)}` : money(n);
}
