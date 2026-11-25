import { useGame } from '../../store/gameStore';
import { rulesSummary, useSettings } from '../../store/settingsStore';
import { money } from '../format';
import styles from '../screens/Screens.module.css';

import type { Route } from '../route';

const LINKS: { route: Route; label: string; href: string }[] = [
  { route: 'play', label: 'Play', href: '#/' },
  { route: 'setup', label: 'Table setup', href: '#/setup' },
  { route: 'chart', label: 'Strategy chart', href: '#/chart' },
  { route: 'stats', label: 'Stats', href: '#/stats' },
];

export function TopBar({ route }: { route: Route }) {
  const bankroll = useGame((s) => s.game.bankroll);
  const rules = useSettings((s) => s.rules);
  return (
    <header className={styles.top}>
      <a href="#/" className={styles.logo} style={{ color: 'inherit', textDecoration: 'none' }}>
        <span className={styles.logoMark} aria-hidden>
          21
        </span>
        <span>Blackjack Trainer</span>
      </a>
      <nav className={styles.nav} aria-label="Main">
        {LINKS.map((l) => (
          <a key={l.route} href={l.href} aria-current={route === l.route ? 'page' : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className={styles.spacer} />
      <span className={styles.chip} title="Current rules">
        {rulesSummary(rules)}
      </span>
      <div className={styles.bankroll} aria-label={`Bankroll ${money(bankroll)}`}>
        <span>Bankroll</span>
        <strong data-testid="bankroll">{money(bankroll)}</strong>
      </div>
    </header>
  );
}
