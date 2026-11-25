import clsx from 'clsx';
import { useEffect, useRef, type CSSProperties } from 'react';
import { rankLabel } from '../../engine/cards';
import { occupiedSeats } from '../../engine/game';
import type { GameState, Hand as HandType, Seat as SeatType } from '../../engine/types';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { handKeyLabel } from '../../stats/stats';
import { money } from '../format';
import { Card, CardBack } from './Card';
import { Chip, chipStack } from './Chip';
import { Hand, totalLabel } from './Hand';
import styles from './Table.module.css';

const STAGGER = 0.12;
export const BOT_NAMES = ['Ava', 'Leo', 'Sam', 'Mia', 'Zoe'];

/** Seats sit on a shallow arc, left (seat 1) to right (seat 5); %-based so it scales. */
function seatPosition(i: number): CSSProperties {
  const angle = ((165 - i * 37.5) * Math.PI) / 180;
  const left = 50 + 38 * Math.cos(angle);
  const top = 72 + 13 * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

export function seatName(seat: SeatType): string {
  if (seat.type === 'bot') return `${BOT_NAMES[seat.index]} (bot)`;
  if (seat.type === 'you')
    return `You · Seat ${seat.index + 1}${seat.hands.length > 1 ? ' · Split' : ''}`;
  return `Seat ${seat.index + 1}`;
}

/** Short status shown next to the total, e.g. "Stood ✓", "Your turn", "Next". */
function handStatus(game: GameState, seat: SeatType, hand: HandType, index: number): string {
  if (hand.result) return '';
  const active = game.active?.seatIndex === seat.index && game.active.handIndex === index;
  if (active) return seat.type === 'you' ? 'Your turn' : 'Playing';
  switch (hand.status) {
    case 'stood':
    case 'done':
      return 'Stood ✓';
    case 'doubled':
      return 'Doubled';
    case 'busted':
      return 'Bust';
    case 'surrendered':
      return 'Surrendered';
    case 'blackjack':
      return '';
    case 'waiting':
      return game.active?.seatIndex === seat.index ? 'Next' : 'Waiting';
    default:
      return '';
  }
}

function betLabel(seat: SeatType): { amount: number; text: string } {
  if (seat.hands.length === 0)
    return seat.type === 'empty'
      ? { amount: 0, text: '' }
      : { amount: seat.baseBet, text: money(seat.baseBet) };
  const bets = seat.hands.map((h) => h.bet);
  const total = bets.reduce((a, b) => a + b, 0);
  if (bets.length > 1 && bets.every((b) => b === bets[0]))
    return { amount: bets[0], text: `${money(bets[0])} ×${bets.length}` };
  return { amount: total, text: money(total) };
}

function BetSpot({ seat }: { seat: SeatType }) {
  const { amount, text } = betLabel(seat);
  const chips = chipStack(amount);
  return (
    <div className={clsx(styles.betSpot, amount === 0 && styles.betSpotEmpty)} aria-hidden>
      {amount > 0 && (
        <>
          <div className={styles.chipStack}>
            {chips.map((v, i) => (
              <Chip key={i} value={v} size={34} style={{ top: -i * 3 }} />
            ))}
          </div>
          <span className={styles.betAmount}>{text}</span>
        </>
      )}
    </div>
  );
}

function EmptySeat({ seat, canSit }: { seat: SeatType; canSit: boolean }) {
  const cycleSeat = useSettings((s) => s.cycleSeat);
  return (
    <div
      className={clsx(styles.seat, styles.emptySeat)}
      style={seatPosition(seat.index)}
      data-testid={`seat-${seat.index + 1}`}
      role="group"
      aria-label={`Seat ${seat.index + 1}: empty`}
    >
      <div className={styles.sitSpot} aria-hidden>
        +
      </div>
      <button
        type="button"
        className={styles.sitHere}
        onClick={() => cycleSeat(seat.index)}
        disabled={!canSit}
        title={canSit ? undefined : 'You can sit down between rounds'}
      >
        Sit here
      </button>
      <span className={styles.seatNo}>Seat {seat.index + 1}</span>
    </div>
  );
}

function Seat({
  seat,
  game,
  order,
  seatsDealt,
}: {
  seat: SeatType;
  game: GameState;
  order: number;
  seatsDealt: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isActiveSeat = game.active?.seatIndex === seat.index;
  useEffect(() => {
    if (isActiveSeat && window.matchMedia?.('(max-width: 768px)').matches)
      ref.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [isActiveSeat, game.active?.handIndex]);

  const name = seatName(seat);
  const compact = seat.hands.length >= 3;
  const delays: [number, number] = [order * STAGGER, (seatsDealt + 1 + order) * STAGGER];

  return (
    <div
      ref={ref}
      className={styles.seat}
      style={seatPosition(seat.index)}
      data-testid={`seat-${seat.index + 1}`}
      aria-label={name}
      role="group"
    >
      <div className={styles.handsRow}>
        {seat.hands.map((h, i) => (
          <Hand
            key={h.id}
            hand={h}
            active={isActiveSeat && game.active?.handIndex === i}
            compact={compact}
            delays={delays}
            label={`Seat ${seat.index + 1} hand ${i + 1}`}
            status={handStatus(game, seat, h, i)}
          />
        ))}
      </div>
      <BetSpot seat={seat} />
      <span className={clsx(styles.name, seat.type === 'you' && styles.nameYou)}>
        {seat.type === 'you' && <span className={styles.nameDot} aria-hidden />}
        {name}
      </span>
    </div>
  );
}

function Stack({ count, label }: { count: number; label: string }) {
  return (
    <div className={styles.stack} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.stackCard} style={{ left: i * 3, top: -i * 3 }}>
          <CardBack size="sm" />
        </div>
      ))}
      <span className={styles.small}>{label}</span>
    </div>
  );
}

export function Table() {
  const game = useGame((s) => s.game);
  const drill = useGame((s) => s.drill);
  const stopDrill = useGame((s) => s.stopDrill);
  const seated = occupiedSeats(game);
  const n = seated.length;
  const decksLeft = Math.max(0, Math.round((game.shoe.length / 52) * 2) / 2);
  const discardCards = game.discard === 0 ? 0 : Math.min(4, 1 + Math.floor(game.discard / 60));
  const shoeCards = Math.max(1, Math.min(4, Math.ceil(decksLeft / 2)));
  const holeDown = game.dealer.some((c) => c.faceDown);
  const visibleDealer = game.dealer.filter((c) => !c.faceDown);
  const youUp = game.seats.find(
    (s) => s.type === 'you' && !game.insuranceAnswered.includes(s.index),
  );
  const canSit = game.phase === 'betting';

  return (
    <section className={styles.felt} aria-label="Blackjack table">
      <div className={styles.tray} aria-label={`Discard tray: ${game.discard} cards`}>
        {discardCards > 0 ? (
          <Stack count={discardCards} label="Discard" />
        ) : (
          <div className={styles.stack} aria-hidden>
            <div className={styles.trayEmpty} />
            <span className={styles.small}>Discard</span>
          </div>
        )}
      </div>

      <div className={styles.dealer} data-testid="dealer">
        <span className={styles.label}>Dealer</span>
        <div className={styles.cards} style={{ minHeight: 'var(--card-h)' }}>
          {game.dealer.map((c, i) => (
            <Card
              key={c.id + i}
              card={c}
              delay={i === 0 ? n * STAGGER : i === 1 ? (2 * n + 1) * STAGGER : 0}
            />
          ))}
        </div>
        {game.dealer.length > 0 && (
          <span className={styles.pill} aria-live="polite">
            {holeDown && game.dealer[0]
              ? `Shows ${rankLabel(game.dealer[0].rank)}`
              : totalLabel(visibleDealer)}
          </span>
        )}
      </div>

      <div className={styles.shoe} aria-label={`Shoe: ${decksLeft} decks left`}>
        <Stack count={shoeCards} label={`Shoe · ${decksLeft} decks left`} />
      </div>

      <div className={styles.print} aria-hidden>
        <strong>BLACKJACK PAYS 3 TO 2</strong>
        <span>
          {game.rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s'} ·
          Insurance pays 2 to 1
        </span>
      </div>

      {game.phase === 'insurance' && youUp && (
        <div className={styles.banner} role="dialog" aria-label="Insurance">
          <strong>Insurance?</strong>
          Dealer shows an Ace · Seat {youUp.index + 1} · costs {money(youUp.hands[0].bet / 2)}
        </div>
      )}

      <div className={styles.seats}>
        {game.seats.map((seat) =>
          seat.type === 'empty' ? (
            <EmptySeat key={seat.index} seat={seat} canSit={canSit} />
          ) : (
            <Seat
              key={seat.index}
              seat={seat}
              game={game}
              order={seated.indexOf(seat)}
              seatsDealt={n}
            />
          ),
        )}
      </div>

      {drill && (
        <div className={styles.drillChip}>
          Drill: {handKeyLabel(drill.handKey)} · {Math.min(drill.done + 1, drill.total)}/
          {drill.total}
          <button type="button" onClick={stopDrill}>
            Stop
          </button>
        </div>
      )}
    </section>
  );
}
