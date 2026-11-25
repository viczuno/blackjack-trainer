import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/blackjack-trainer/', // must equal the repo name for GitHub Pages
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: { include: ['src/engine/**', 'src/strategy/**'] },
  },
});
