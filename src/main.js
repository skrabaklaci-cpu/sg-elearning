import './styles/tokens.css';
import './styles/base.css';
import './styles/pixel.css';
import './components/index.js';

import { characterLine, validateContent } from './content/index.js';
import { emotionFor } from './config/emotions.js';
import { h } from './lib/dom.js';
import { startRouter } from './router.js';
import { store } from './state/store.js';
import { LessonScreen } from './screens/LessonScreen.js';
import { MapScreen } from './screens/MapScreen.js';
import { StartScreen } from './screens/StartScreen.js';

const SCREENS = { start: StartScreen, map: MapScreen, lesson: LessonScreen };

const root = document.getElementById('app');
let cleanup = null;

function render(route) {
  cleanup?.();
  cleanup = null;
  root.replaceChildren();
  const screen = SCREENS[route.name] ?? MapScreen;
  cleanup = screen(root, route.params) ?? null;
  // A képernyőolvasók az új nézet címénél folytassák.
  root.querySelector('h1')?.focus({ preventScroll: true });
}

async function boot() {
  if (import.meta.env.DEV) {
    const errors = validateContent();
    if (errors.length) console.warn(`[tartalom] ${errors.length} hiba a src/data fájlokban:\n- ${errors.join('\n- ')}`);
  }

  await store.init();
  const flush = () => store.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  // Globális rétegek: szintlépés és rövid üzenetek.
  const levelUp = h('sg-level-up');
  const toast = h('sg-toast');
  document.body.append(levelUp, toast);

  store.on('levelup', (event) => levelUp.show(event));
  store.on('streak', ({ count }) => {
    const event = count > 1 ? 'streak' : 'streakStart';
    toast.show({ character: 'guide', emotion: emotionFor(event), text: characterLine('guide', event, { n: count }) });
  });

  startRouter(render);
}

boot();
