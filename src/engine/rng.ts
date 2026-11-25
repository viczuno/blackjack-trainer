/** mulberry32: small, fast, seedable PRNG. Returns the value in [0, 1) and the next seed. */
export function nextRandom(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** A stateful generator, handy for shuffles. */
export function mulberry32(seed: number): { next: () => number; seed: () => number } {
  let s = seed >>> 0;
  return {
    next() {
      const [v, n] = nextRandom(s);
      s = n;
      return v;
    },
    seed: () => s,
  };
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
