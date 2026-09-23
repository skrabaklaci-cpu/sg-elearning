import { icon } from '../components/icons.js';
import { emotionFor } from '../config/emotions.js';
import { characterLine, getWorld } from '../content/index.js';
import { h } from '../lib/dom.js';
import { navigate } from '../router.js';
import { getLessonProgress, lessonStatuses, worldProgress } from '../state/progress.js';
import { store } from '../state/store.js';
import './subject.css';

const STATUS = {
  completed: { label: 'Teljesítve', icon: 'check' },
  available: { label: 'Indulhat!', icon: 'play' },
  locked: { label: 'Zárva', icon: 'lock' },
  soon: { label: 'Hamarosan', icon: 'hourglass' },
};

/** Egy tárgy leckéi listában (a korábbi térkép helyett). */
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

  root.append(
    h(
      'main',
      { class: 'screen subject-screen' },
      h('sg-hud', { back: '#/subjects', 'back-label': 'Vissza a tárgyakhoz' }),
      h(
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
            h(
              'p',
              { class: 'subject-head__progress' },
              icon('star'),
              `${completed} / ${total} lecke teljesítve`,
            ),
          ),
          h(
            'ol',
            { class: 'lessons' },
            world.lessons.map((lesson, index) => LessonRow(world, lesson, index, statuses[index])),
          ),
        ),
      ),
    ),
  );

  dialog.react('greet');
}

function LessonRow(world, lesson, index, status) {
  const meta = STATUS[status];
  const progress = getLessonProgress(store.getState(), lesson.id);
  let note = lesson.summary ?? '';
  if (status === 'completed') note = `Teljesítve · ${progress.quizBest}/${progress.quizTotal} helyes válasz`;
  else if (status === 'locked') note = 'Előbb az előző leckét fejezd be.';
  else if (status === 'soon') note = 'Ez a lecke még készül.';

  const open = () => {
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
  };

  return h(
    'li',
    { class: ['lesson-row', `is-${status}`] },
    h(
      'button',
      { class: 'lesson-row__btn', type: 'button', onClick: open, 'aria-label': `${index + 1}. lecke: ${lesson.title} (${meta.label})` },
      h('span', { class: 'lesson-row__tile', 'aria-hidden': 'true' }, icon(meta.icon)),
      h(
        'span',
        { class: 'lesson-row__body' },
        h(
          'span',
          { class: 'lesson-row__top' },
          h('span', { class: 'lesson-row__num' }, `${index + 1}. lecke`),
          status === 'available' && h('span', { class: 'tag lesson-row__tag' }, 'Indulhat!'),
        ),
        h('span', { class: 'lesson-row__title' }, lesson.title),
        note && h('span', { class: 'lesson-row__note' }, note),
      ),
      h('span', { class: 'lesson-row__go', 'aria-hidden': 'true' }, icon('arrowRight')),
    ),
  );
}
