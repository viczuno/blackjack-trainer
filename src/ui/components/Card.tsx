import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { Card as CardType } from '../../engine/types';
import { useSettings } from '../../store/settingsStore';
import styles from './Card.module.css';

interface Props {
  card: CardType;
  /** Seconds to wait before the deal animation (initial deal stagger). */
  delay?: number;
  /** Doubled cards are shown rotated. */
  rotated?: boolean;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

const RED = new Set(['♥', '♦']);
const SUIT_NAMES: Record<string, string> = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
};

export function cardLabel(c: CardType): string {
  return c.faceDown ? 'face-down card' : `${c.rank} of ${SUIT_NAMES[c.suit]}`;
}

export function Card({ card, delay = 0, rotated, size = 'md', style }: Props) {
  const reduce = useReducedMotion();
  const fast = useSettings((s) => s.fastMode);
  const still = reduce || fast;
  const dims = (size === 'sm' ? { '--w': '46px', '--h': '65px' } : {}) as CSSProperties;
  return (
    <motion.div
      className={styles.card}
      style={{ ...dims, ...style }}
      initial={still ? false : { opacity: 0, x: 160, y: -220, rotate: -12 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: rotated ? 90 : 0 }}
      transition={{ duration: still ? 0 : 0.25, delay: still ? 0 : delay, ease: 'easeOut' }}
      role="img"
      aria-label={cardLabel(card)}
    >
      <motion.div
        className={styles.inner}
        initial={false}
        animate={{ rotateY: card.faceDown ? 180 : 0 }}
        transition={{ duration: still ? 0 : 0.35 }}
      >
        <div className={clsx(styles.face, RED.has(card.suit) && styles.red)} aria-hidden>
          {!card.faceDown && (
            <>
              <div className={styles.corner}>
                <span>{card.rank}</span>
                <span>{card.suit}</span>
              </div>
              <div className={styles.pip}>{card.suit}</div>
              <div className={clsx(styles.corner, styles.cornerBottom)}>
                <span>{card.rank}</span>
                <span>{card.suit}</span>
              </div>
            </>
          )}
        </div>
        <div className={styles.back} aria-hidden />
      </motion.div>
    </motion.div>
  );
}

export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <Card card={{ rank: 'A', suit: '♠', id: 'back', faceDown: true }} size={size} />;
}
