import clsx from 'clsx';
import { activeHand, dealerUpcard, disabledReason, rankLabel } from '../../engine/cards';
import { canDeal, totalYouBet, youSeats } from '../../engine/game';
import type { PlayerAction } from '../../engine/types';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { ACTION_LABEL, handName } from '../../strategy/explain';
import { getBest } from '../../strategy/resolve';
import { money, signedMoney } from '../format';
import { Chip } from './Chip';
import styles from './Controls.module.css';
import { Switch } from './Switch';

export const ACTIONS: { action: PlayerAction; key: string }[] = [
  { action: 'hit', key: 'H' },
  { action: 'stand', key: 'S' },
  { action: 'double', key: 'D' },
  { action: 'split', key: 'P' },
  { action: 'surrender', key: 'R' },
];

function HintControls() {
  const hintMode = useSettings((s) => s.hintMode);
  const setHintMode = useSettings((s) => s.setHintMode);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.undoSnapshot !== null);
  const testMode = hintMode === 'off';
  return (
    <div className={styles.right}>
      <Switch
        label={testMode ? 'Test mode' : 'Hints'}
        checked={hintMode === 'always'}
        disabled={testMode}
        onChange={(v) => setHintMode(v ? 'always' : 'onMistake')}
      />
      <button
        type="button"
        className={styles.btn}
        onClick={undo}
        disabled={!canUndo || testMode}
        aria-keyshortcuts="U"
      >
        ↶ Undo
      </button>
    </div>
  );
}

function PlayBar() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const hintMode = useSettings((s) => s.hintMode);
  const hand = activeHand(game);
  const seat = hand ? game.seats[hand.seatIndex] : null;
  const up = dealerUpcard(game);
  const best = seat?.type === 'you' ? getBest(game) : null;
  const showBest = hintMode === 'always' && best;

  if (!hand || !seat || seat.type !== 'you') {
    return (
      <div className={styles.bar} data-testid="action-bar">
        <div className={styles.info}>
          <span className={styles.eyebrow}>
            {game.phase === 'dealerTurn' ? 'Dealer' : seat ? `Seat ${seat.index + 1} · Bot` : ''}
          </span>
          <span className={styles.infoMain}>
            {game.phase === 'dealerTurn' ? 'Dealer is playing…' : 'Bot is playing…'}
          </span>
        </div>
        <div />
        <HintControls />
      </div>
    );
  }

  const handsInSeat = seat.hands.length;
  return (
    <div className={styles.bar} data-testid="action-bar">
      <div className={styles.info}>
        <span className={styles.eyebrow}>
          Seat {seat.index + 1} · Hand {game.active!.handIndex + 1} of {handsInSeat}
        </span>
        <span className={styles.infoMain}>
          {best ? handName(best.lookup) : ''} vs dealer {up ? rankLabel(up.rank) : ''}
        </span>
      </div>
      <div className={styles.buttons} role="group" aria-label="Actions">
        {ACTIONS.map(({ action, key }) => {
          const reason = disabledReason(game, action);
          const isBest = showBest && best!.action === action;
          return (
            <button
              key={action}
              type="button"
              className={clsx(styles.action, styles[action], isBest && styles.best)}
              disabled={reason !== null}
              onClick={() => act(action)}
              aria-keyshortcuts={key}
              title={reason ?? undefined}
              data-testid={`action-${action}`}
            >
              {isBest && <span className={styles.bestTag}>★ BEST PLAY</span>}
              <span className={styles.actionTop}>
                <span className={styles.dot} aria-hidden />
                {ACTION_LABEL[action]}
                <span className={styles.key} aria-hidden>
                  {key}
                </span>
              </span>
              {reason && <span className={styles.reason}>{reason}</span>}
            </button>
          );
        })}
      </div>
      <HintControls />
    </div>
  );
}

function BetBar() {
  const game = useGame((s) => s.game);
  const deal = useGame((s) => s.deal);
  const resetBankroll = useGame((s) => s.resetBankroll);
  const bet = useSettings((s) => s.bet);
  const lastBet = useSettings((s) => s.lastBet);
  const setBet = useSettings((s) => s.setBet);
  const seats = youSeats(game).length;
  const total = totalYouBet(game);
  const broke = game.bankroll < 5;
  return (
    <div className={styles.bar} data-testid="bet-bar">
      <div className={styles.info}>
        <span className={styles.eyebrow}>
          Bet per hand · {seats} seat{seats === 1 ? '' : 's'}
        </span>
        <span className={styles.infoMain}>
          {money(bet)} {seats > 1 && <small>(total {money(total)})</small>}
        </span>
      </div>
      <div className={styles.chips}>
        {[5, 25, 100].map((v) => (
          <Chip
            key={v}
            value={v}
            size={48}
            onClick={() => setBet(bet + v)}
            disabled={(bet + v) * Math.max(1, seats) > game.bankroll}
          />
        ))}
        <button type="button" className={styles.btn} onClick={() => setBet(0)}>
          Clear
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setBet(lastBet)}
          disabled={lastBet === bet}
        >
          Repeat {money(lastBet)}
        </button>
      </div>
      <div className={styles.right}>
        {broke ? (
          <button
            type="button"
            className={clsx(styles.btn, styles.primary)}
            onClick={resetBankroll}
          >
            Reset bankroll
          </button>
        ) : (
          <button
            type="button"
            className={clsx(styles.btn, styles.primary)}
            onClick={deal}
            disabled={!canDeal(game)}
            aria-keyshortcuts="Space"
            data-testid="deal"
          >
            Deal <span className={styles.key}>Space</span>
          </button>
        )}
      </div>
    </div>
  );
}

function InsuranceBar() {
  const game = useGame((s) => s.game);
  const insurance = useGame((s) => s.insurance);
  const hintMode = useSettings((s) => s.hintMode);
  const seat = game.seats.find(
    (s) => s.type === 'you' && !game.insuranceAnswered.includes(s.index),
  );
  return (
    <div className={styles.bar} data-testid="insurance-bar">
      <div className={styles.info}>
        <span className={styles.eyebrow}>Insurance · Seat {seat ? seat.index + 1 : ''}</span>
        <span className={styles.infoMain}>
          Take insurance for {seat ? money(seat.hands[0].bet / 2) : ''}?
        </span>
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={clsx(styles.action, styles.double)}
          onClick={() => insurance(true)}
          aria-keyshortcuts="I"
        >
          <span className={styles.actionTop}>
            Yes <span className={styles.key}>I</span>
          </span>
        </button>
        <button
          type="button"
          className={clsx(styles.action, styles.hit, hintMode === 'always' && styles.best)}
          onClick={() => insurance(false)}
          aria-keyshortcuts="N"
        >
          {hintMode === 'always' && <span className={styles.bestTag}>★ BEST PLAY</span>}
          <span className={styles.actionTop}>
            No <span className={styles.key}>N</span>
          </span>
        </button>
      </div>
      <div />
    </div>
  );
}

function SummaryBar() {
  const game = useGame((s) => s.game);
  const nextRound = useGame((s) => s.nextRound);
  const net = game.roundNet;
  const decisions = game.roundDecisions;
  const right = decisions.filter((d) => d.correct).length;
  return (
    <div className={styles.bar} data-testid="summary-bar">
      <div className={styles.info}>
        <span className={styles.eyebrow}>Round result</span>
        <span className={clsx(styles.net, net > 0 && styles.pos, net < 0 && styles.neg)}>
          {signedMoney(net)}
        </span>
      </div>
      <div className={styles.info} style={{ textAlign: 'center' }}>
        <span className={styles.eyebrow}>Decisions</span>
        <span className={styles.infoMain}>
          {decisions.length === 0
            ? 'No decisions this round'
            : `${right} of ${decisions.length} optimal`}
        </span>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={clsx(styles.btn, styles.primary)}
          onClick={nextRound}
          aria-keyshortcuts="Space"
          data-testid="next-round"
          autoFocus
        >
          Next round <span className={styles.key}>Space</span>
        </button>
      </div>
    </div>
  );
}

export function ActionBar() {
  const phase = useGame((s) => s.game.phase);
  if (phase === 'betting') return <BetBar />;
  if (phase === 'insurance') return <InsuranceBar />;
  if (phase === 'settled') return <SummaryBar />;
  return <PlayBar />;
}
