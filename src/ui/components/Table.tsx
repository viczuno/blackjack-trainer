import clsx from 'clsx';
import { useEffect, useRef, type CSSProperties } from 'react';
import { occupiedSeats } from '../../engine/game';
import type { GameState, Seat as SeatType } from '../../engine/types';
import { useGame } from '../../store/gameStore';
import { handKeyLabel } from '../../stats/stats';
import { money } from '../format';
import { Card } from './Card';
import { Chip, chipStack } from './Chip';
import { Hand, totalLabel } from './Hand';
import styles from './Table.module.css';

const STAGGER = 0.12;

/** Seats sit on an arc, left (seat 1) to right (seat 5); %-based so it scales. */
function seatPosition(i: number): CSSProperties {
  const angle = ((165 - i * 37.5) * Math.PI) / 180;
  const left = 50 + 41 * Math.cos(angle);
  const top = 62 + 30 * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

function BetSpot({ amount }: { amount: number }) {
  const chips = chipStack(amount);
  return (
    <div className={clsx(styles.betSpot, amount === 0 && styles.betSpotEmpty)} aria-hidden>
      {amount > 0 && (
        <>
          <div className={styles.chipStack}>
            {chips.map((v, i) => (
              <Chip key={i} value={v} size={40} style={{ top: -i * 4 }} />
            ))}
          </div>
          <span className={styles.betAmount}>{money(amount)}</span>
        </>
      )}
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

  const name =
    seat.type === 'you'
      ? `You · Seat ${seat.index + 1}`
      : seat.type === 'bot'
        ? `Bot · Seat ${seat.index + 1}`
        : `Seat ${seat.index + 1}`;
  const bet =
    seat.hands.length > 0
      ? seat.hands.reduce((s, h) => s + h.bet, 0)
      : seat.type === 'empty'
        ? 0
        : seat.baseBet;
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
          />
        ))}
      </div>
      <BetSpot amount={bet} />
      <span
        className={clsx(
          styles.name,
          seat.type === 'you' && styles.nameYou,
          isActiveSeat && styles.nameActive,
        )}
      >
        {seat.type === 'empty' ? 'Empty' : name}
      </span>
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
  const trayHeight = Math.min(46, Math.round((game.discard / (game.rules.decks * 52)) * 60));
  const visibleDealer = game.dealer.filter((c) => !c.faceDown);
  const youUp = game.seats.find(
    (s) => s.type === 'you' && !game.insuranceAnswered.includes(s.index),
  );

  return (
    <section className={styles.felt} aria-label="Blackjack table">
      <div className={styles.tray} aria-label={`Discard tray: ${game.discard} cards`}>
        <div className={styles.trayBox}>
          <div className={styles.trayStack} style={{ height: trayHeight }} />
        </div>
        <span className={styles.small}>Discard</span>
      </div>

      <div className={styles.dealer} data-testid="dealer">
        <span className={styles.label}>Dealer</span>
        <div className={styles.cards} style={{ minHeight: 90 }}>
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
            {totalLabel(visibleDealer)}
          </span>
        )}
      </div>

      <div className={styles.shoe} aria-label={`Shoe: ${decksLeft} decks left`}>
        <div className={styles.shoeBox} />
        <span className={styles.small}>{decksLeft} decks left</span>
      </div>

      <div className={styles.print} aria-hidden>
        <strong>BLACKJACK PAYS 3 TO 2</strong>
        <span>
          Dealer {game.rules.dealerHitsSoft17 ? 'hits' : 'stands on'} soft 17 · Insurance pays 2 to
          1
        </span>
      </div>

      {game.phase === 'insurance' && youUp && (
        <div className={styles.banner} role="dialog" aria-label="Insurance">
          <strong>Insurance?</strong>
          Dealer shows an Ace · Seat {youUp.index + 1} · costs {money(youUp.hands[0].bet / 2)}
        </div>
      )}

      <div className={styles.seats}>
        {game.seats.map((seat) => (
          <Seat
            key={seat.index}
            seat={seat}
            game={game}
            order={seated.indexOf(seat)}
            seatsDealt={n}
          />
        ))}
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
