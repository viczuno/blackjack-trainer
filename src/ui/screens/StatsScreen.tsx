import clsx from 'clsx';
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { accuracy, handKeyLabel, missedHands, mostMissed } from '../../stats/stats';
import { StatTile } from '../components/Coach';
import ctl from '../components/Controls.module.css';
import { Modal } from '../components/Overlays';
import panel from '../components/Panels.module.css';
import { signedMoney } from '../format';
import { navigate } from '../route';
import styles from './Screens.module.css';

function LineChart({ points }: { points: number[] }) {
  const w = 600;
  const h = 200;
  const pad = 28;
  if (points.length < 2)
    return <p className={styles.muted}>Make a few decisions to see your accuracy over time.</p>;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Accuracy over the last ${points.length} decisions, now ${points.at(-1)}%`}
    >
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={pad - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="var(--text-muted)">
            {v}%
          </text>
        </g>
      ))}
      <path
        d={`${d} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
        fill="var(--gold)"
        opacity="0.12"
      />
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points.at(-1)!)} r="4" fill="var(--gold)" />
    </svg>
  );
}

export function StatsScreen() {
  const stats = useGame((s) => s.stats);
  const resetStats = useGame((s) => s.resetStats);
  const startDrill = useGame((s) => s.startDrill);
  const [confirm, setConfirm] = useState(false);
  const acc = accuracy(stats);
  const missed = missedHands(stats);
  const most = mostMissed(stats);
  const roundsNet = stats.lastRounds.reduce((a, b) => a + b, 0);

  const drill = (key: string) => {
    startDrill(key);
    const g = useGame.getState();
    if (g.game.phase === 'settled') g.nextRound();
    navigate('play');
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>Stats</h1>
          <p className={styles.muted}>Saved on this device.</p>
        </div>
        <button
          type="button"
          className={clsx(ctl.btn, ctl.danger)}
          onClick={() => setConfirm(true)}
        >
          Reset stats
        </button>
      </div>
      <div className={styles.tiles4}>
        <StatTile label="Accuracy" value={acc === null ? '—' : `${acc.toFixed(1)}%`} />
        <StatTile label="Decisions" value={String(stats.decisions)} />
        <StatTile label="Streak / best" value={`${stats.streak} / ${stats.bestStreak}`} />
        <StatTile label={`Last ${stats.lastRounds.length} rounds`} value={signedMoney(roundsNet)} />
      </div>
      <div className={styles.cols}>
        <section className={panel.card} aria-label="Accuracy over time">
          <div className={panel.cardTitle}>Accuracy over time</div>
          <LineChart points={stats.accuracyHistory} />
        </section>
        <section className={panel.card} aria-label="Most missed">
          <div className={panel.cardTitle}>Most missed</div>
          {most ? (
            <>
              <p style={{ fontSize: 20, fontWeight: 800 }}>{handKeyLabel(most.handKey)}</p>
              <p className={styles.muted}>
                Wrong {most.wrong} of {most.seen} times.
              </p>
              <button
                type="button"
                className={clsx(ctl.btn, ctl.primary)}
                style={{ marginTop: 12 }}
                onClick={() => drill(most.handKey)}
              >
                Drill it
              </button>
            </>
          ) : (
            <p className={styles.muted}>
              A hand shows up here once you have seen it 3 times and missed it.
            </p>
          )}
        </section>
      </div>
      <section className={panel.card} aria-label="Missed hands">
        <div className={panel.cardTitle}>Missed hands</div>
        {missed.length === 0 ? (
          <p className={styles.muted}>No mistakes yet. Nice.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hand</th>
                <th>Seen</th>
                <th>Wrong</th>
                <th>
                  <span className="sr-only">Drill</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {missed.slice(0, 20).map((m) => (
                <tr key={m.handKey}>
                  <td>{handKeyLabel(m.handKey)}</td>
                  <td>{m.seen}</td>
                  <td>{m.wrong}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className={ctl.btn} onClick={() => drill(m.handKey)}>
                      Drill it
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {confirm && (
        <Modal
          title="Reset all stats?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button type="button" className={ctl.btn} onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={clsx(ctl.btn, ctl.primary)}
                onClick={() => {
                  resetStats();
                  setConfirm(false);
                }}
              >
                Reset stats
              </button>
            </>
          }
        >
          <p className={styles.muted}>
            This clears accuracy, streaks and missed hands on this device. It can’t be undone.
          </p>
        </Modal>
      )}
    </main>
  );
}
