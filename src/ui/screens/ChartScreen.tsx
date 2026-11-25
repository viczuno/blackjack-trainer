import { useSettings, rulesSummary } from '../../store/settingsStore';
import panel from '../components/Panels.module.css';
import { Legend, StrategyGrid } from '../components/StrategyGrid';
import styles from './Screens.module.css';

export function ChartScreen() {
  const rules = useSettings((s) => s.rules);
  return (
    <main className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>Strategy chart</h1>
          <p className={styles.muted}>
            Basic strategy for {rules.decks} decks. Columns are the dealer’s up card.
          </p>
        </div>
        <span className={styles.chip} style={{ display: 'inline-block' }}>
          {rulesSummary(rules)}
        </span>
      </div>
      <div className={styles.cols3}>
        <section className={panel.card} aria-label="Hard totals">
          <div className={panel.cardTitle}>Hard totals</div>
          <div className={styles.gridScroll}>
            <StrategyGrid kind="hard" rules={rules} size="lg" />
          </div>
        </section>
        <section className={panel.card} aria-label="Soft totals">
          <div className={panel.cardTitle}>Soft totals</div>
          <div className={styles.gridScroll}>
            <StrategyGrid kind="soft" rules={rules} size="lg" />
          </div>
        </section>
        <section className={panel.card} aria-label="Pairs">
          <div className={panel.cardTitle}>Pairs</div>
          <div className={styles.gridScroll}>
            <StrategyGrid kind="pairs" rules={rules} size="lg" />
          </div>
        </section>
      </div>
      <div className={styles.cols}>
        <section className={panel.card} aria-label="Legend">
          <div className={panel.cardTitle}>Legend</div>
          <Legend />
        </section>
        <section className={panel.card} aria-label="Tips">
          <div className={panel.cardTitle}>Tips</div>
          <ul className={styles.tips}>
            <li>
              <b>Always split Aces and 8s.</b> Never split 10s or 5s.
            </li>
            <li>
              <b>Stand on 12–16 against 2–6</b> (except 12 vs 2 or 3); hit them against 7–A.
            </li>
            <li>
              <b>Double 11</b> against everything but an Ace
              {rules.dealerHitsSoft17 ? ' — with H17, double against the Ace too' : ''}.
            </li>
            <li>
              <b>Soft 18</b> stands against 2, 7, 8, doubles against 3–6 and hits against 9, 10, A.
            </li>
            <li>
              <b>Never take insurance.</b> It is a side bet that loses over time.
            </li>
            {!rules.lateSurrender && (
              <li>Surrender is off, so the chart shows the fallback plays.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
