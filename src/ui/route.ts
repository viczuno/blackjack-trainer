export type Route = 'play' | 'setup' | 'chart' | 'stats';

/** Hash routing so refreshes on GitHub Pages never 404. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'setup' || path === 'chart' || path === 'stats') return path;
  return 'play';
}

export function navigate(route: Route) {
  window.location.hash = route === 'play' ? '#/' : `#/${route}`;
}
