# blackjack-trainer

Commands: build `npm run build` · test `npm test` · lint `npm run lint` · run `npm run dev` · e2e `npm run e2e`

- `src/engine` and `src/strategy` are pure TypeScript (no React); keep them that way and covered by Vitest.
- `src/strategy/tables.ts` is the source of truth for basic strategy; any change needs the 280-cell tests updated.
