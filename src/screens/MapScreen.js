import { icon } from '../components/icons.js';
import { emotionFor } from '../config/emotions.js';
import { characterLine, getCharacterText, getWorlds } from '../content/index.js';
import { h } from '../lib/dom.js';
import { navigate } from '../router.js';
import { lessonStatuses, worldProgress } from '../state/progress.js';
import { store } from '../state/store.js';
import './map.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A leckék oszlopa (0–2) a cikcakkos ösvényen. */
const ZIGZAG = [1, 2, 1, 0];

const STATUS = {
  completed: { label: 'Teljesítve', icon: 'check' },
  available: { label: 'Indulhat!', icon: 'play' },
  locked: { label: 'Zárva', icon: 'lock' },
  soon: { label: 'Hamarosan', icon: 'hourglass' },
};

/** Világtérkép: a három tárgy „régiója”, bennük a leckék ösvénye. */
export function MapScreen(root) {
  const state = store.getState();
  const cleanups = [];

  root.append(
    h(
      'main',
      { class: 'screen map' },
      h('sg-hud', { back: '#/', 'back-label': 'Kezdőképernyő' }),
      h(
        'div',
        { class: 'screen__scroll grid-bg' },
        h(
          'div',
          { class: 'container map__inner' },
          h(
            'header',
            { class: 'map__header' },
            h('p', { class: 'kicker' }, 'Világtérkép'),
            h('h1', { class: 'map__title pixel-title', tabindex: '-1' }, 'Merre indulsz?'),
            h('p', { class: 'muted' }, 'Válassz egy világot! A leckék sorban nyílnak meg.'),
          ),
          getWorlds().map((world) => Region(world, state, cleanups)),
        ),
      ),
    ),
  );

  return () => cleanups.forEach((fn) => fn());
}

function Region(world, state, cleanups) {
  const mentor = getCharacterText(world.mentor);
  const { completed, total } = worldProgress(state, world);
  const headingId = `region-${world.id}`;

  return h(
    'section',
    { class: 'region', 'aria-labelledby': headingId },
    h(
      'header',
      { class: 'region__header panel' },
      h(
        'div',
        { class: 'region__portrait' },
        h('sg-character', { character: world.mentor, emotion: completed > 0 ? 'happy' : 'neutral', crop: 'portrait', 'max-scale': '2' }),
      ),
      h(
        'div',
        { class: 'region__heading' },
        h('p', { class: 'kicker' }, world.realm),
        h('h2', { class: 'region__title', id: headingId }, world.title),
        h('p', { class: 'region__mentor' }, `${mentor.name}, ${mentor.role.toLowerCase()}`),
        h(
          'div',
          { class: 'region__progress' },
          h(
            'span',
            { class: 'region__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(completed), 'aria-label': 'Teljesített leckék' },
            h('span', { class: 'region__fill', style: { width: `${total ? (completed / total) * 100 : 0}%` } }),
          ),
          h('span', { class: 'region__count' }, `${completed}/${total} lecke`),
        ),
      ),
    ),
    LessonPath(world, lessonStatuses(state, world), cleanups),
  );
}

function LessonPath(world, statuses, cleanups) {
  const toast = document.querySelector('sg-toast');
  const nodes = [];

  const steps = world.lessons.map((lesson, i) => {
    const status = statuses[i];
    const meta = STATUS[status];
    const node = h(
      'button',
      {
        class: 'path__node',
        type: 'button',
        'aria-label': `${i + 1}. lecke: ${lesson.title} (${meta.label})`,
        onClick: () => open(lesson, status),
      },
      icon(meta.icon),
    );
    nodes.push(node);
    return h(
      'li',
      { class: ['path__step', `is-${status}`], style: { gridRow: String(i + 1), gridColumn: String(ZIGZAG[i % ZIGZAG.length] + 1) } },
      node,
      h(
        'p',
        { class: 'path__label', 'aria-hidden': 'true' },
        h('span', { class: 'path__num' }, `${i + 1}. lecke`),
        h('span', { class: 'path__name' }, lesson.title),
        h('span', { class: 'path__status' }, meta.label),
      ),
    );
  });

  function open(lesson, status) {
    if (status === 'available' || status === 'completed') {
      navigate(`/lesson/${lesson.id}`);
      return;
    }
    const event = status === 'soon' ? 'soon' : 'locked';
    toast?.show({ character: world.mentor, emotion: emotionFor(event), text: characterLine(world.mentor, event) });
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'path__dots');
  svg.setAttribute('aria-hidden', 'true');
  const list = h('ol', { class: 'path__list' }, steps);
  const wrap = h('div', { class: 'path' }, svg, list);

  // A pöttyözött ösvényt a gombok tényleges helyzetéből rajzoljuk, így bármilyen szélességen stimmel.
  const draw = () => drawDots(svg, wrap, steps, nodes, statuses);
  const observer = new ResizeObserver(draw);
  observer.observe(wrap);
  cleanups.push(() => observer.disconnect());

  return wrap;
}

/**
 * Derékszögű, pöttyözött ösvény két egymást követő lecke között: le a gomb alól (a felirat
 * mögött), vízszintesen a sorok közti résben, majd le a következő gomb tetejéig.
 */
function drawDots(svg, wrap, steps, nodes, statuses) {
  const box = wrap.getBoundingClientRect();
  if (!box.width) return;
  const size = Number.parseFloat(getComputedStyle(wrap).getPropertyValue('--dot')) || 6;
  const spacing = size * 2.5;
  svg.setAttribute('viewBox', `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`);
  svg.setAttribute('width', String(Math.round(box.width)));
  svg.setAttribute('height', String(Math.round(box.height)));

  const local = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top };
  };

  const rects = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = local(nodes[i]);
    const b = local(nodes[i + 1]);
    const ax = (a.left + a.right) / 2;
    const bx = (b.left + b.right) / 2;
    const midY = (local(steps[i]).bottom + local(steps[i + 1]).top) / 2;
    const points = [
      { x: ax, y: a.bottom },
      { x: ax, y: midY },
      { x: bx, y: midY },
      { x: bx, y: b.top },
    ];
    const open = statuses[i] === 'completed';
    for (const { x, y } of dotsAlong(points, spacing)) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(Math.round(x - size / 2)));
      rect.setAttribute('y', String(Math.round(y - size / 2)));
      rect.setAttribute('width', String(size));
      rect.setAttribute('height', String(size));
      if (open) rect.setAttribute('class', 'is-open');
      rects.push(rect);
    }
  }
  svg.replaceChildren(...rects);
}

/** Egyenletes közű pontok egy töröttvonal mentén (a két végpont kimarad). */
function dotsAlong(points, spacing) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segments.push({ from: points[i], to: points[i + 1], start: total, length });
    total += length;
  }
  const count = Math.floor(total / spacing);
  const offset = (total - (count - 1) * spacing) / 2;
  const dots = [];
  for (let k = 0; k < count; k++) {
    const d = offset + k * spacing;
    const seg = segments.find((s) => d <= s.start + s.length) ?? segments.at(-1);
    const t = seg.length ? (d - seg.start) / seg.length : 0;
    dots.push({ x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t });
  }
  return dots;
}
