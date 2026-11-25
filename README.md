# Blackjack Trainer

Practice blackjack basic strategy at a 5-seat table with a live coach that shows the best play.

Blackjack Trainer is a static web app for learning basic strategy. You play at a table with up to five seats, can run several hands at once, and the coach highlights the best button, marks the cell in a strategy chart and explains the move in plain words. It runs in the browser, installs on a phone as a PWA and needs no account or backend.

## Features

- Project skeleton with CI and GitHub Pages deploy (the game itself lands in follow-up PRs)

## Tech stack

TypeScript, React, Vite, Zustand, Framer Motion, CSS Modules. Vitest and Playwright for tests. Deployed to GitHub Pages with GitHub Actions.

## Getting started

### Prerequisites

- Node.js 22 or newer

### Install and run

```bash
git clone https://github.com/viczuno/blackjack-trainer.git
cd blackjack-trainer
npm install
npm run dev
```

## Testing

```bash
npm test
npm run lint
```

## Project structure

```
.github/workflows/  CI: lint, test, build, deploy to GitHub Pages
public/             static assets (favicon, icons)
src/                application source
tests/              Vitest unit tests and Playwright e2e tests
```

## Contributing

Changes go through pull requests using Conventional Commits
(`feat:`, `fix:`, `docs:` …).

## License

MIT. See [LICENSE](LICENSE).
