import { useEffect } from 'react';
import type { PlayerAction } from '../engine/types';
import { useGame } from '../store/gameStore';

const ACTION_KEYS: Record<string, PlayerAction> = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
  r: 'surrender',
};

/** H/S/D/P/R actions, U undo, Space deal / next round, I/N insurance. */
export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      const st = useGame.getState();
      const phase = st.game.phase;
      const k = e.key.toLowerCase();
      if (k === ' ' || e.code === 'Space') {
        if (phase === 'betting') st.deal();
        else if (phase === 'settled') st.nextRound();
        else return;
        e.preventDefault();
        return;
      }
      if (phase === 'playerTurns' && ACTION_KEYS[k]) {
        st.act(ACTION_KEYS[k]);
        e.preventDefault();
      } else if (phase === 'insurance' && (k === 'i' || k === 'n')) {
        st.insurance(k === 'i');
        e.preventDefault();
      } else if (k === 'u') {
        st.undo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
