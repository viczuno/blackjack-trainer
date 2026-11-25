import clsx from 'clsx';
import { handTotal, isBlackjack } from '../../engine/cards';
import type { Card as CardType, Hand as HandType } from '../../engine/types';
import { money, signedMoney } from '../format';
import { Card } from './Card';
import styles from './Table.module.css';

export function totalLabel(cards: CardType[], blackjack = false): string {
  if (cards.length === 0) return '';
  if (blackjack) return 'Blackjack';
  const { total, soft } = handTotal(cards);
  if (total > 21) return `Bust ${total}`;
  return soft && total < 21 ? `Soft ${total}` : String(total);
}

function badge(hand: HandType): { text: string; cls: string } | null {
  switch (hand.result) {
    case 'win':
      return { text: `Win ${signedMoney(hand.payout)}`, cls: styles.win };
    case 'blackjack':
      return { text: `Blackjack ${signedMoney(hand.payout)}`, cls: styles.blackjack };
    case 'push':
      return { text: 'Push', cls: styles.push };
    case 'surrender':
      return { text: `Surrender ${money(hand.payout)}`, cls: styles.surrender };
    case 'lose':
      return {
        text: handTotal(hand.cards).total > 21 ? 'Bust' : `Lose ${money(hand.payout)}`,
        cls: styles.lose,
      };
    default:
      return null;
  }
}

interface Props {
  hand: HandType;
  active: boolean;
  compact: boolean;
  /** Deal-order delay for each of the first two cards, in seconds. */
  delays: [number, number];
  label: string;
  /** Short status after the total, e.g. "Stood ✓", "Your turn". */
  status?: string;
}

export function Hand({ hand, active, compact, delays, label, status }: Props) {
  const bj = isBlackjack(hand);
  const b = badge(hand);
  const bust = handTotal(hand.cards).total > 21;
  return (
    <div
      className={clsx(styles.hand, active && styles.activeHand, compact && styles.compact)}
      aria-label={`${label}: ${totalLabel(hand.cards, bj)}${hand.result ? `, ${b?.text}` : ''}`}
      aria-current={active ? 'true' : undefined}
      data-testid="hand"
    >
      {b && <div className={clsx(styles.badge, b.cls)}>{b.text}</div>}
      <div className={styles.cards}>
        {hand.cards.map((c, i) => {
          const rotated = hand.doubled && i === 2;
          return (
            <div key={c.id + i} className={rotated ? styles.rotatedSlot : undefined}>
              <Card
                card={c}
                delay={i < 2 && !hand.isSplitHand ? delays[i] : 0}
                rotated={rotated}
                size={compact ? 'sm' : 'md'}
              />
            </div>
          );
        })}
      </div>
      <span
        className={clsx(
          styles.pill,
          bj && styles.pillGold,
          bust && styles.pillBust,
          active && styles.pillActive,
        )}
      >
        <strong>{totalLabel(hand.cards, bj)}</strong>
        {hand.doubled ? ' ×2' : ''}
        {status && <span className={styles.status}>{status}</span>}
      </span>
    </div>
  );
}
