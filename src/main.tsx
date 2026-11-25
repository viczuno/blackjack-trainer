import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/global.css';
import App from './App.tsx';
import { useGame } from './store/gameStore';
import { useSettings } from './store/settingsStore';
import { card } from './engine/shoe';

if (import.meta.env.DEV) {
  // Handy for manual testing in the console: stack cards with __bj.stack('8 6 8 10 ...').
  Object.assign(window, {
    __bj: {
      game: useGame,
      settings: useSettings,
      stack(order: string) {
        const cards = order.split(/\s+/).map((c, i) => card(c, `dev${i}-${Date.now()}`));
        useGame.setState((s) => ({ game: { ...s.game, shoe: [...cards, ...s.game.shoe] } }));
      },
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
