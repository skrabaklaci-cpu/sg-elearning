import { icon } from '../components/icons.js';
import { emotionFor } from '../config/emotions.js';
import { characterLine, getWorld } from '../content/index.js';
import { h } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/util.js';
import { navigate } from '../router.js';
import { lessonStatuses, worldProgress } from '../state/progress.js';
import { store } from '../state/store.js';
import './subject.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A leckék oszlopa (0–2) a cikcakkos ösvényen. */
const ZIGZAG = [1, 2, 1, 0];

const STATUS = {
  completed: { label: 'Teljesítve', icon: 'check' },
  available: { label: 'Indulhat!', icon: 'play' },
  locked: { label: 'Zárva', icon: 'lock' },
  soon: { label: 'Hamarosan', icon: 'hourglass' },
};

/** Egy tárgy térképe: a leckék egymás után, cikcakkos ösvényen. */
export function SubjectScreen(root, { id }) {
  const world = getWorld(id);
  if (!world) {
    navigate('/subjects');
    return;
  }
  const state = store.getState();
  const statuses = lessonStatuses(state, world);
  const { completed, total } = worldProgress(state, world);
  const dialog = h('sg-dialog', { character: world.mentor, class: 'subject-head__dialog' });
  const cleanups = [];

  const scroller = h(
    'div',
    { class: 'screen__scroll grid-bg' },
    h(
      'div',
      { class: 'container subject-screen__inner' },
      h(
        'header',
        { class: 'subject-head' },
        h('p', { class: 'kicker' }, world.realm),
        h('h1', { class: 'subject-head__title pixel-title', tabindex: '-1' }, world.title),
        dialog,
        h('p', { class: 'subject-head__progress' }, icon('star'), `${completed} / ${total} lecke teljesítve`),
      ),
      LessonPath(world, statuses, cleanups),
    ),
  );

  root.append(
    h(
      'main',
      { class: 'screen subject-screen', dataset: { subject: world.id } },
      h('sg-hud', { back: '#/subjects', 'back-label': 'Vissza a tárgyakhoz' }),
      scroller,
    ),
  );

  dialog.react('greet');

  // Hosszú térképen a következő leckéhez görgetünk, hogy ne kelljen keresgélni.
  const next = scroller.querySelector('.is-available .path__node') ?? scroller.querySelector('.is-completed .path__node');
  if (next) {
    requestAnimationFrame(() => next.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
  }

  return () => cleanups.forEach((fn) => fn());
}

function LessonPath(world, statuses, cleanups) {
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
      {
        class: ['path__step', `is-${status}`],
        style: { gridRow: String(i + 1), gridColumn: String(ZIGZAG[i % ZIGZAG.length] + 1) },
      },
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
    document.querySelector('sg-toast')?.show({
      character: world.mentor,
      emotion: emotionFor(event),
      text: characterLine(world.mentor, event),
    });
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'path__dots');
  svg.setAttribute('aria-hidden', 'true');
  const wrap = h('div', { class: 'path' }, svg, h('ol', { class: 'path__list' }, steps));

  // A pöttyözött ösvényt a gombok tényleges helyzetéből rajzoljuk, így bármilyen szélességen stimmel.
  const observer = new ResizeObserver(() => drawDots(svg, wrap, steps, nodes, statuses));
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
    const done = statuses[i] === 'completed';
    for (const { x, y } of dotsAlong(points, spacing)) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(Math.round(x - size / 2)));
      rect.setAttribute('y', String(Math.round(y - size / 2)));
      rect.setAttribute('width', String(size));
      rect.setAttribute('height', String(size));
      if (done) rect.setAttribute('class', 'is-open');
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
  if (count < 1) return [];
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
