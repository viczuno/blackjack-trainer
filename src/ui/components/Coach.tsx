import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { activeHand, rankLabel } from '../../engine/cards';
import type { GameState } from '../../engine/types';
import { useGame, type Mistake } from '../../store/gameStore';
import { useSettings, type HintMode } from '../../store/settingsStore';
import { accuracy, handKeyLabel, mostMissed } from '../../stats/stats';
import { ACTION_LABEL, handName, INSURANCE_EXPLANATION, upcardName } from '../../strategy/explain';
import { getBest, type BestPlay } from '../../strategy/resolve';
import type { ChartKind } from '../../strategy/tables';
import styles from './Panels.module.css';
import { Legend, StrategyGrid } from './StrategyGrid';

export interface CoachView {
  best: BestPlay | null;
  mistake: Mistake | null;
  highlight: { table: ChartKind; row: string; upcard: string } | null;
  hintMode: HintMode;
}

/** What the coach shows right now, shared by the sidebar, the peek bar and the live region. */
export function useCoach(): CoachView {
  const game = useGame((s) => s.game);
  const lastCoach = useGame((s) => s.lastCoach);
  const hintMode = useSettings((s) => s.hintMode);
  const hand = activeHand(game);
  const isYou = hand ? game.seats[hand.seatIndex].type === 'you' : false;
  const best = isYou ? getBest(game) : null;
  const mistake = hintMode !== 'off' && lastCoach && !lastCoach.decision.correct ? lastCoach : null;
  let highlight: CoachView['highlight'] = null;
  if (hintMode === 'always' && best?.lookup.cell) highlight = best.lookup.cell;
  else if (hintMode === 'onMistake' && mistake?.best.lookup.cell)
    highlight = mistake.best.lookup.cell;
  return { best, mistake, highlight, hintMode };
}

function Head({
  icon,
  tone,
  children,
}: {
  icon: string;
  tone?: 'bad' | 'good';
  children: ReactNode;
}) {
  return (
    <div className={styles.coachHead}>
      <span
        className={clsx(
          styles.coachIcon,
          tone === 'bad' && styles.coachIconBad,
          tone === 'good' && styles.coachIconGood,
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className={styles.coachAction}>{children}</span>
    </div>
  );
}

function situation(game: GameState, best: BestPlay) {
  const up = game.dealer[0];
  return `${handName(best.lookup)} vs ${upcardName(up ? rankLabel(up.rank) : '')}`;
}

export function CoachCard() {
  const game = useGame((s) => s.game);
  const lastCoach = useGame((s) => s.lastCoach);
  const drill = useGame((s) => s.drill);
  const { best, mistake, hintMode } = useCoach();

  let body: ReactNode;
  if (game.phase === 'betting') {
    body = (
      <>
        <Head icon="21">Place your bet</Head>
        <p className={styles.coachText}>
          {drill
            ? `Drilling ${handKeyLabel(drill.handKey)}. Deal to get the situation.`
            : 'Pick chips, then Deal. Play perfect basic strategy — the coach checks every decision.'}
        </p>
      </>
    );
  } else if (game.phase === 'insurance') {
    body =
      hintMode === 'always' ? (
        <>
          <Head icon="✕">Don’t take insurance</Head>
          <p className={styles.coachText}>{INSURANCE_EXPLANATION}</p>
        </>
      ) : (
        <>
          <Head icon="?">Insurance?</Head>
          <p className={styles.coachText}>
            The dealer shows an Ace. Decide before the dealer peeks.
          </p>
        </>
      );
  } else if (hintMode === 'off') {
    body = (
      <>
        <Head icon="✎">Test mode</Head>
        <p className={styles.coachText}>
          No hints and no undo. Your mistakes are reviewed when the shoe ends.
        </p>
      </>
    );
  } else if (best && hintMode === 'always') {
    body = (
      <>
        <Head icon="★">Best play: {ACTION_LABEL[best.action]}</Head>
        <p className={styles.coachText}>
          <b>{situation(game, best)}.</b> {best.explanation}
        </p>
      </>
    );
  } else if (best) {
    body = (
      <>
        <Head icon="?">Your move</Head>
        <p className={styles.coachText}>
          <b>{situation(game, best)}.</b> Hints show only after a mistake.
        </p>
      </>
    );
  } else if (lastCoach?.decision.correct) {
    body = (
      <>
        <Head icon="✓" tone="good">
          Correct — {ACTION_LABEL[lastCoach.decision.chosen]}
        </Head>
        <p className={styles.coachText}>{lastCoach.best.explanation}</p>
      </>
    );
  } else if (game.phase === 'settled') {
    const d = game.roundDecisions;
    body = (
      <>
        <Head icon="✓" tone={d.every((x) => x.correct) ? 'good' : 'bad'}>
          Round over
        </Head>
        <p className={styles.coachText}>
          {d.length === 0
            ? 'No decisions this round.'
            : `${d.filter((x) => x.correct).length} of ${d.length} decisions matched basic strategy.`}
        </p>
      </>
    );
  } else {
    body = (
      <>
        <Head icon="…">Watching</Head>
        <p className={styles.coachText}>
          {game.phase === 'dealerTurn'
            ? 'The dealer is drawing.'
            : 'A bot is playing perfect basic strategy.'}
        </p>
      </>
    );
  }

  return (
    <section
      className={clsx(styles.card, styles.coach, mistake && styles.coachMistake)}
      aria-label="Coach"
    >
      <div className={styles.cardTitle}>Coach</div>
      {mistake && (
        <>
          <Head icon="✗" tone="bad">
            Mistake
          </Head>
          <p className={styles.coachText}>
            You chose <b>{ACTION_LABEL[mistake.decision.chosen]}</b> on{' '}
            {handKeyLabel(mistake.decision.handKey)} — best play was{' '}
            <b>{ACTION_LABEL[mistake.best.action]}</b>. {mistake.best.explanation}
          </p>
          <div className={styles.divider} />
        </>
      )}
      {body}
    </section>
  );
}

export function StrategyCard({ highlight }: { highlight: CoachView['highlight'] }) {
  const rules = useGame((s) => s.game.rules);
  // The tab follows the highlighted cell; a manual pick holds until the highlight moves.
  const hlKey = highlight ? `${highlight.table}-${highlight.row}-${highlight.upcard}` : 'none';
  const [manual, setManual] = useState<{ tab: ChartKind; forKey: string } | null>(null);
  const tab: ChartKind =
    manual && (manual.forKey === hlKey || !highlight)
      ? manual.tab
      : (highlight?.table ?? manual?.tab ?? 'hard');
  const setTab = (t: ChartKind) => setManual({ tab: t, forKey: hlKey });
  const tabs: [ChartKind, string][] = [
    ['hard', 'Hard'],
    ['soft', 'Soft'],
    ['pairs', 'Pairs'],
  ];
  return (
    <section className={styles.card} aria-label="Strategy chart">
      <div className={styles.cardTitle}>
        Strategy chart
        <div className={styles.tabs} role="tablist">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <StrategyGrid
        kind={tab}
        rules={rules}
        highlight={highlight?.table === tab ? highlight : null}
      />
      <Legend />
    </section>
  );
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
    </div>
  );
}

export function StatsCard() {
  const stats = useGame((s) => s.stats);
  const acc = accuracy(stats);
  const missed = mostMissed(stats);
  return (
    <section className={styles.card} aria-label="Session stats">
      <div className={styles.cardTitle}>Your accuracy</div>
      <div className={styles.tiles}>
        <StatTile label="Accuracy" value={acc === null ? '—' : `${acc.toFixed(0)}%`} />
        <StatTile label="Streak" value={String(stats.streak)} />
        <StatTile label="Best streak" value={String(stats.bestStreak)} />
        <StatTile label="Decisions" value={String(stats.decisions)} />
      </div>
      <p className={styles.missed}>
        Most missed:{' '}
        {missed ? (
          <b>
            {handKeyLabel(missed.handKey)} ({missed.wrong}/{missed.seen})
          </b>
        ) : (
          'nothing yet'
        )}
      </p>
    </section>
  );
}

export function Sidebar() {
  const coach = useCoach();
  return (
    <div className={styles.sidebar}>
      <CoachCard />
      <StrategyCard highlight={coach.highlight} />
      <StatsCard />
    </div>
  );
}

/** Mobile: a peek bar with the best play that opens the sidebar as a bottom sheet. */
export function BottomSheet() {
  const [open, setOpen] = useState(false);
  const { best, mistake, hintMode } = useCoach();
  const peek =
    hintMode === 'always' && best
      ? `Best play: ${ACTION_LABEL[best.action]}`
      : mistake
        ? `Mistake — best was ${ACTION_LABEL[mistake.best.action]}`
        : 'Coach & chart';
  return (
    <>
      <button
        type="button"
        className={styles.peek}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        {peek} <span aria-hidden>▲</span>
      </button>
      {open && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-label="Coach and strategy chart">
            <button type="button" className={styles.sheetHandle} onClick={() => setOpen(false)}>
              {peek} <span aria-hidden>▼</span>
            </button>
            <Sidebar />
          </div>
        </>
      )}
    </>
  );
}

/** Screen-reader announcement of the hint state. */
export function LiveHint() {
  const { best, mistake, hintMode } = useCoach();
  const text =
    hintMode === 'always' && best
      ? `Best play: ${ACTION_LABEL[best.action]}`
      : mistake
        ? `Not optimal. Best play was ${ACTION_LABEL[mistake.best.action]}`
        : '';
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {text}
    </div>
  );
}
