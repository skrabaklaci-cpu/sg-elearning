// Hash-alapú router: #/ (kezdőképernyő), #/map (térkép), #/lesson/:id (lecke).
// A GitHub Pages nem ad SPA-fallbacket, és a Wix-iframe-ben is ez a megbízható megoldás.

const ROUTES = [
  { name: 'start', pattern: /^\/?$/ },
  { name: 'map', pattern: /^\/map\/?$/ },
  { name: 'lesson', pattern: /^\/lesson\/([\w-]+)\/?$/, keys: ['id'] },
];

export function parseRoute(hash) {
  let path = String(hash ?? '').replace(/^#/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // hibás kódolás: a nyers útvonallal próbálkozunk
  }
  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (match) {
      const params = Object.fromEntries((route.keys ?? []).map((key, i) => [key, match[i + 1]]));
      return { name: route.name, params };
    }
  }
  return { name: 'map', params: {} };
}

let render = null;

export function startRouter(onRoute) {
  render = onRoute;
  window.addEventListener('hashchange', refresh);
  refresh();
}

/** Az aktuális útvonal újrarajzolása (pl. a haladás törlése után). */
export function refresh() {
  render?.(parseRoute(window.location.hash));
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) refresh();
  else window.location.hash = path;
}
