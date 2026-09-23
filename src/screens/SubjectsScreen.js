import { icon } from '../components/icons.js';
import { getCharacterText, getWorlds } from '../content/index.js';
import { h } from '../lib/dom.js';
import { worldProgress } from '../state/progress.js';
import { store } from '../state/store.js';
import './subjects.css';

/** Tárgyválasztó: a kalauz köszöntője után innen indul a tanulás. */
export function SubjectsScreen(root) {
  const state = store.getState();

  root.append(
    h(
      'main',
      { class: 'screen subjects' },
      h('sg-hud', { back: '#/', 'back-label': 'Kezdőképernyő' }),
      h(
        'div',
        { class: 'screen__scroll grid-bg' },
        h(
          'div',
          { class: 'container subjects__inner' },
          h(
            'header',
            { class: 'subjects__header' },
            h('p', { class: 'kicker' }, 'Tárgyválasztás'),
            h('h1', { class: 'subjects__title pixel-title', tabindex: '-1' }, 'Mit tanulsz ma?'),
            h('p', { class: 'muted' }, 'Válassz tárgyat, és a mentorod végigkísér a leckéken.'),
          ),
          h(
            'ul',
            { class: 'subjects__list' },
            getWorlds().map((world) => h('li', null, SubjectCard(world, state))),
          ),
        ),
      ),
    ),
  );
}

function SubjectCard(world, state) {
  const mentor = getCharacterText(world.mentor);
  const { completed, total } = worldProgress(state, world);
  const percent = total ? (completed / total) * 100 : 0;

  return h(
    'a',
    { class: 'subject panel', href: `#/subject/${world.id}`, dataset: { subject: world.id } },
    h(
      'span',
      { class: 'subject__portrait' },
      h('sg-character', { character: world.mentor, emotion: completed > 0 ? 'happy' : 'neutral', crop: 'portrait', 'max-scale': '2' }),
    ),
    h(
      'span',
      { class: 'subject__body' },
      h('span', { class: 'kicker' }, world.realm),
      h('span', { class: 'subject__title' }, world.title),
      h('span', { class: 'subject__mentor' }, `${mentor.name}, ${mentor.role.toLowerCase()}`),
      h('span', { class: 'subject__lead' }, world.description),
      h(
        'span',
        { class: 'subject__progress' },
        h(
          'span',
          {
            class: 'subject__bar',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': String(total),
            'aria-valuenow': String(completed),
            'aria-label': 'Teljesített leckék',
          },
          h('span', { class: 'subject__fill', style: { width: `${percent}%` } }),
        ),
        h('span', { class: 'subject__count' }, `${completed}/${total} lecke`),
      ),
    ),
    h('span', { class: 'subject__go', 'aria-hidden': 'true' }, icon('arrowRight')),
  );
}
