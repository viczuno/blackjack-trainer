import clsx from 'clsx';
import { useState } from 'react';
import { STARTING_BANKROLL } from '../../engine/game';
import type { Rules } from '../../engine/types';
import { useGame } from '../../store/gameStore';
import { useSettings, type HintMode, type PracticeFocus } from '../../store/settingsStore';
import ctl from '../components/Controls.module.css';
import { Modal } from '../components/Overlays';
import panel from '../components/Panels.module.css';
import { SegmentedControl, Switch } from '../components/Switch';
import { money } from '../format';
import { navigate } from '../route';
import styles from './Screens.module.css';

function spotPosition(i: number) {
  const angle = ((165 - i * 37.5) * Math.PI) / 180;
  return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${30 + 48 * Math.sin(angle)}%` };
}

const HINT_MODES: { value: HintMode; label: string; help: string }[] = [
  {
    value: 'always',
    label: 'Always show the best play',
    help: 'Best button tagged, chart cell highlighted, reason explained.',
  },
  {
    value: 'onMistake',
    label: 'Only after a mistake',
    help: 'No tag before you act. A wrong move shows a toast with Undo.',
  },
  {
    value: 'off',
    label: 'Test mode (no hints)',
    help: 'No hints, no undo. Mistakes are reviewed at the end of the shoe.',
  },
];

const FOCUS: { value: PracticeFocus; label: string }[] = [
  { value: 'all', label: 'All hands' },
  { value: 'hard', label: 'Hard totals' },
  { value: 'soft', label: 'Soft totals' },
  { value: 'pairs', label: 'Pairs' },
];

export function SetupScreen() {
  const s = useSettings();
  const game = useGame((x) => x.game);
  const deal = useGame((x) => x.deal);
  const resetBankroll = useGame((x) => x.resetBankroll);
  const [confirmReset, setConfirmReset] = useState(false);
  const midRound = game.phase !== 'betting' && game.phase !== 'settled';
  const youCount = s.seats.filter((t) => t === 'you').length;
  const rule = <K extends keyof Rules>(k: K, v: Rules[K]) =>
    s.setRules({ [k]: v } as Partial<Rules>);

  const start = () => {
    if (game.phase === 'settled') useGame.getState().nextRound();
    navigate('play');
    if (!midRound) deal();
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>Table setup</h1>
          <p className={styles.muted}>
            {midRound
              ? 'Changes apply from the next round.'
              : 'Choose your seats, rules and how the coach helps.'}
          </p>
        </div>
        <button
          type="button"
          className={clsx(ctl.btn, ctl.primary)}
          onClick={start}
          disabled={youCount === 0 && !s.seats.includes('bot')}
          data-testid="deal-first"
        >
          {midRound ? 'Back to the table' : 'Deal first round'}
        </button>
      </div>

      <div className={styles.cols}>
        <section className={panel.card} aria-label="Seats">
          <div className={panel.cardTitle}>Seats · click to cycle empty → you → bot</div>
          <div className={styles.mini}>
            <span className={styles.miniDealer}>DEALER</span>
            {s.seats.map((t, i) => (
              <button
                key={i}
                type="button"
                className={clsx(
                  styles.spot,
                  t === 'you' && styles.spotYou,
                  t === 'bot' && styles.spotBot,
                )}
                style={spotPosition(i)}
                onClick={() => s.cycleSeat(i)}
                aria-label={`Seat ${i + 1}: ${t}. Click to change.`}
                data-testid={`setup-seat-${i + 1}`}
              >
                {t === 'you' ? 'You' : t === 'bot' ? 'Bot' : 'Empty'}
                <small>Seat {i + 1}</small>
              </button>
            ))}
          </div>
          <div className={styles.row} style={{ marginTop: 12 }}>
            <div className={styles.rowLabel}>
              Bet per hand
              <small>
                {youCount} of your seat{youCount === 1 ? '' : 's'} · total {money(s.bet * youCount)}{' '}
                · bankroll {money(game.bankroll)}
              </small>
            </div>
            <div className={styles.stepper}>
              <button
                type="button"
                className={ctl.btn}
                onClick={() => s.setBet(Math.max(5, s.bet - 5))}
                aria-label="Decrease bet"
              >
                −
              </button>
              <output aria-live="polite">{money(s.bet)}</output>
              <button
                type="button"
                className={ctl.btn}
                onClick={() => s.setBet(s.bet + 5)}
                aria-label="Increase bet"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              Bankroll
              <small>Start again with {money(STARTING_BANKROLL)}</small>
            </div>
            <button
              type="button"
              className={clsx(ctl.btn, ctl.danger)}
              onClick={() => setConfirmReset(true)}
              disabled={midRound}
            >
              Reset bankroll
            </button>
          </div>
        </section>

        <section className={panel.card} aria-label="Rules">
          <div className={panel.cardTitle}>Rules</div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Decks</div>
            <SegmentedControl
              label="Decks"
              value={s.rules.decks}
              options={[4, 6, 8].map((d) => ({ value: d as Rules['decks'], label: String(d) }))}
              onChange={(v) => rule('decks', v)}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              Dealer soft 17
              <small>{s.rules.dealerHitsSoft17 ? 'Hits (H17)' : 'Stands (S17)'}</small>
            </div>
            <SegmentedControl
              label="Dealer soft 17"
              value={s.rules.dealerHitsSoft17 ? 'H17' : 'S17'}
              options={[
                { value: 'S17', label: 'Stands' },
                { value: 'H17', label: 'Hits' },
              ]}
              onChange={(v) => rule('dealerHitsSoft17', v === 'H17')}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Double after split</div>
            <Switch
              label={s.rules.doubleAfterSplit ? 'On' : 'Off'}
              checked={s.rules.doubleAfterSplit}
              onChange={(v) => rule('doubleAfterSplit', v)}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Late surrender</div>
            <Switch
              label={s.rules.lateSurrender ? 'On' : 'Off'}
              checked={s.rules.lateSurrender}
              onChange={(v) => rule('lateSurrender', v)}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Re-split aces</div>
            <Switch
              label={s.rules.resplitAces ? 'On' : 'Off'}
              checked={s.rules.resplitAces}
              onChange={(v) => rule('resplitAces', v)}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Max hands from splitting</div>
            <SegmentedControl
              label="Max hands per seat"
              value={s.rules.maxHandsPerSeat}
              options={[2, 3, 4].map((d) => ({
                value: d as Rules['maxHandsPerSeat'],
                label: String(d),
              }))}
              onChange={(v) => rule('maxHandsPerSeat', v)}
            />
          </div>
          <p className={styles.muted} style={{ marginTop: 10, fontSize: 12 }}>
            Fixed: double on any first two cards · blackjack pays 3:2 · insurance 2:1 · dealer peeks
            with A or 10 up · reshuffle at 75%.
          </p>
        </section>
      </div>

      <div className={styles.cols}>
        <section className={panel.card} aria-label="Coach mode">
          <div className={panel.cardTitle}>Coach</div>
          <div className={styles.radio} role="radiogroup" aria-label="Hint mode">
            {HINT_MODES.map((m) => (
              <label key={m.value}>
                <input
                  type="radio"
                  name="hint"
                  checked={s.hintMode === m.value}
                  onChange={() => s.setHintMode(m.value)}
                />
                <span>
                  {m.label}
                  <small>{m.help}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className={panel.card} aria-label="Practice">
          <div className={panel.cardTitle}>Practice focus</div>
          <div className={styles.focusChips}>
            {FOCUS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={s.focus === f.value}
                onClick={() => s.setFocus(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className={styles.muted} style={{ marginTop: 10, fontSize: 13 }}>
            With a focus, your first hand is dealt a random situation of that type every round.
          </p>
          <div className={styles.row} style={{ marginTop: 6 }}>
            <div className={styles.rowLabel}>
              Fast mode<small>No delays or animations — good for drilling.</small>
            </div>
            <Switch
              label={s.fastMode ? 'On' : 'Off'}
              checked={s.fastMode}
              onChange={s.setFastMode}
            />
          </div>
        </section>
      </div>

      {confirmReset && (
        <Modal
          title="Reset bankroll?"
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <button type="button" className={ctl.btn} onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={clsx(ctl.btn, ctl.primary)}
                onClick={() => {
                  resetBankroll();
                  setConfirmReset(false);
                }}
              >
                Reset to {money(STARTING_BANKROLL)}
              </button>
            </>
          }
        >
          <p className={styles.muted}>
            Your bankroll goes back to {money(STARTING_BANKROLL)}. Stats are kept.
          </p>
        </Modal>
      )}
    </main>
  );
}
