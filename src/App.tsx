import { useEffect, useState } from 'react';
import { ReviewModal, Toast } from './ui/components/Overlays';
import { TopBar } from './ui/components/TopBar';
import { parseRoute, type Route } from './ui/route';
import { ChartScreen } from './ui/screens/ChartScreen';
import { SetupScreen } from './ui/screens/SetupScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { TableScreen } from './ui/screens/TableScreen';
import styles from './ui/screens/Screens.module.css';

const TITLES: Record<Route, string> = {
  play: 'Blackjack Trainer',
  setup: 'Table setup · Blackjack Trainer',
  chart: 'Strategy chart · Blackjack Trainer',
  stats: 'Stats · Blackjack Trainer',
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  return (
    <div className={styles.app}>
      <TopBar route={route} />
      {route === 'play' && <TableScreen />}
      {route === 'setup' && <SetupScreen />}
      {route === 'chart' && <ChartScreen />}
      {route === 'stats' && <StatsScreen />}
      <Toast />
      <ReviewModal />
    </div>
  );
}
