import { icon } from '../components/icons.js';
import { emotionFor } from '../config/emotions.js';
import { characterLine, getCharacterText, getIntro } from '../content/index.js';
import { h } from '../lib/dom.js';
import { navigate, refresh } from '../router.js';
import { displayedStreak, levelInfo } from '../state/progress.js';
import { store } from '../state/store.js';
import './start.css';

/**
 * Kezdőképernyő. Első látogatáskor a kalauz (Csery) bemutatkozik (data/intro.json),
 * visszatérőknek üdvözlés és rövid összegzés.
 */
export function StartScreen(root) {
  const intro = getIntro();
  const guide = getCharacterText('guide');

  const character = h('sg-character', { character: 'guide', emotion: 'neutral', 'max-scale': '5' });
  const bubble = h('sg-speech-bubble', { speaker: guide.name, tail: 'top' });
  const actions = h('div', { class: 'start__actions' });

  root.append(
    h(
      'main',
      { class: 'screen start' },
      h(
        'div',
        { class: 'screen__scroll grid-bg' },
        h(
          'div',
          { class: 'container start__inner' },
          h(
            'header',
            { class: 'start__header' },
            h('p', { class: 'kicker' }, intro.subtitle),
            h('h1', { class: 'start__title pixel-title', tabindex: '-1' }, intro.title),
          ),
          h('div', { class: 'start__stage' }, character),
          bubble,
          actions,
        ),
      ),
    ),
  );

  if (store.getState().flags.introSeen) welcomeBack();
  else playIntro(0);

  function playIntro(index) {
    const line = intro.lines[index];
    const isLast = index === intro.lines.length - 1;
    character.setAttribute('emotion', line.emotion ?? 'happy');
    bubble.say(line.text);

    const next = h(
      'button',
      {
        class: 'btn',
        type: 'button',
        onClick: () => {
          // Első koppintás: a gépelés befejezése; második: következő mondat.
          if (bubble.typing) bubble.skip();
          else if (isLast) finishIntro();
          else playIntro(index + 1);
        },
      },
      isLast ? 'Irány a térkép!' : 'Tovább',
      icon('arrowRight'),
    );
    actions.replaceChildren(
      h(
        'div',
        { class: 'actions' },
        !isLast && h('button', { class: 'btn btn--ghost', type: 'button', onClick: finishIntro }, 'Kihagyom'),
        next,
      ),
      h('p', { class: 'start__progress muted', 'aria-hidden': 'true' }, `${index + 1} / ${intro.lines.length}`),
    );
    if (index > 0) next.focus({ preventScroll: true });
  }

  function finishIntro() {
    store.markIntroSeen();
    navigate('/map');
  }

  function welcomeBack() {
    const state = store.getState();
    const info = levelInfo(state.xp);
    const streak = displayedStreak(state.streak, store.today());
    character.setAttribute('emotion', emotionFor('welcomeBack'));
    bubble.say(characterLine('guide', 'welcomeBack'));

    actions.replaceChildren(
      h(
        'ul',
        { class: 'start__stats', 'aria-label': 'Eddigi eredményeid' },
        h('li', { class: 'tag' }, `${info.level}. szint · ${info.title}`),
        h('li', { class: 'tag tag--dark' }, icon('gem'), `${info.xp} XP`),
        h('li', { class: 'tag tag--dark' }, icon('flame'), `${streak} napos sorozat`),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => navigate('/map') }, 'Tovább a térképre', icon('arrowRight')),
      ),
      h(
        'div',
        { class: 'start__links' },
        h('button', { class: 'link-btn', type: 'button', onClick: () => playIntro(0) }, 'Bemutatkozás újra'),
        h('button', { class: 'link-btn', type: 'button', onClick: confirmReset }, 'Haladás törlése'),
      ),
    );
  }

  function confirmReset() {
    character.setAttribute('emotion', 'surprised');
    bubble.say(characterLine('guide', 'resetConfirm'));
    const cancel = h('button', { class: 'btn btn--ghost', type: 'button', onClick: welcomeBack }, 'Mégse');
    actions.replaceChildren(
      h(
        'div',
        { class: 'actions' },
        cancel,
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onClick: async () => {
              await store.resetProgress();
              refresh();
            },
          },
          'Igen, törlöm',
        ),
      ),
    );
    cancel.focus({ preventScroll: true });
  }
}
