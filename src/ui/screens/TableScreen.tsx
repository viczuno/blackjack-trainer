import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ActionBar } from '../components/ActionBar';
import { BottomSheet, LiveHint, Sidebar } from '../components/Coach';
import { Table } from '../components/Table';
import styles from './Screens.module.css';

export function TableScreen() {
  useKeyboardShortcuts(true);
  return (
    <main className={styles.play}>
      <div className={styles.playMain}>
        <Table />
        <div className={styles.stickyBottom}>
          <div className={styles.mobileOnly}>
            <BottomSheet />
          </div>
          <ActionBar />
        </div>
      </div>
      <aside className={styles.aside} aria-label="Coach, chart and stats">
        <Sidebar />
      </aside>
      <LiveHint />
    </main>
  );
}
