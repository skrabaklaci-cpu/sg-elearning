import { icon } from '../components/icons.js';
import { CORRECT_STREAK_PRAISE, PASS_RATIO } from '../config/progression.js';
import { findLesson } from '../content/index.js';
import { h } from '../lib/dom.js';
import { navigate } from '../router.js';
import { getLessonProgress, lessonStatus } from '../state/progress.js';
import { store } from '../state/store.js';
import './lesson.css';

const STEPS = [
  { id: 'video', label: 'Videó' },
  { id: 'slides', label: 'Diák' },
  { id: 'quiz', label: 'Kvíz' },
];

/** Lecke: videó → diák → kvíz → összegzés. A mentor minden lépésre reagál. */
export function LessonScreen(root, { id }) {
  const found = findLesson(id);
  if (!found) return renderMessage(root, { character: 'guide', event: 'missing', title: 'Nincs ilyen lecke' });

  const { world, lesson, index } = found;
  const status = lessonStatus(store.getState(), world, id);
  if (status === 'locked' || status === 'soon') {
    return renderMessage(root, { character: world.mentor, event: status, title: lesson.title, kicker: world.title });
  }

  const progress = () => getLessonProgress(store.getState(), id);
  const dialog = h('sg-dialog', { character: world.mentor });
  const stage = h('div', { class: 'container lesson__stage' });
  const scroller = h('div', { class: 'screen__scroll grid-bg' }, stage);
  const tabs = STEPS.map((step, i) =>
    h(
      'button',
      { class: 'steps__tab', type: 'button', onClick: () => go(step.id) },
      h('span', { class: 'steps__num', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'steps__label' }, step.label),
      h('span', { class: 'steps__done' }, icon('check', { label: 'kész' })),
    ),
  );

  root.append(
    h(
      'main',
      { class: 'screen lesson' },
      h('sg-hud', { back: '#/map', 'back-label': 'Vissza a térképre' }),
      h(
        'header',
        { class: 'lesson__header' },
        h(
          'div',
          { class: 'container lesson__header-inner' },
          h('p', { class: 'kicker' }, `${world.title} · ${index + 1}. lecke`),
          h('h1', { class: 'lesson__title', tabindex: '-1' }, lesson.title),
          h('nav', { class: 'steps', 'aria-label': 'A lecke lépései' }, tabs),
        ),
      ),
      scroller,
      h('footer', { class: 'lesson__dialog' }, h('div', { class: 'container' }, dialog)),
    ),
  );

  let current = null;
  let videoPlayed = false;

  function isReachable(stepId) {
    const p = progress();
    if (stepId === 'quiz') return Boolean(p.slidesDone || p.completedAt);
    return true;
  }

  function isDone(stepId) {
    const p = progress();
    if (stepId === 'video') return p.videoDone;
    if (stepId === 'slides') return p.slidesDone;
    return Boolean(p.completedAt);
  }

  function updateTabs() {
    STEPS.forEach((step, i) => {
      const tab = tabs[i];
      const isCurrent = current === step.id || (current === 'summary' && step.id === 'quiz');
      tab.disabled = !isReachable(step.id);
      tab.classList.toggle('is-current', isCurrent);
      tab.classList.toggle('is-done', isDone(step.id));
      if (isCurrent) tab.setAttribute('aria-current', 'step');
      else tab.removeAttribute('aria-current');
    });
  }

  function go(stepId) {
    if (!isReachable(stepId)) return;
    current = stepId;
    const view = { video: renderVideo, slides: renderSlides, quiz: renderQuiz }[stepId]();
    stage.replaceChildren(view);
    scroller.scrollTop = 0;
    updateTabs();
  }

  function renderVideo() {
    const hasVideo = /^[\w-]{11}$/.test(lesson.video?.youtubeId ?? '');
    dialog.react(hasVideo ? 'videoIntro' : 'videoSoon');
    return h(
      'section',
      { class: 'lesson__step', 'aria-label': 'Videó' },
      h('sg-video', {
        'video-id': lesson.video?.youtubeId ?? '',
        'video-title': lesson.video?.title ?? lesson.title,
        on: { 'sg-video-play': () => (videoPlayed = true) },
      }),
      lesson.summary && h('p', { class: 'lesson__summary' }, lesson.summary),
      h(
        'button',
        {
          class: 'btn btn--block',
          type: 'button',
          onClick: () => {
            if (videoPlayed) store.completeVideo(id);
            go('slides');
          },
        },
        'Tovább a diákhoz',
        icon('arrowRight'),
      ),
    );
  }

  function renderSlides() {
    dialog.react('slidesIntro');
    const toQuiz = h(
      'button',
      { class: 'btn btn--block', type: 'button', hidden: !progress().slidesDone, onClick: () => go('quiz') },
      'Jöhet a kvíz!',
      icon('arrowRight'),
    );
    const slides = h('sg-slides', {
      slides: lesson.slides,
      on: {
        'sg-slide-change': ({ detail }) => {
          if (detail.index === 0) return; // az első diánál a bevezető mondat marad
          if (detail.slide.mentor) dialog.say(detail.slide.mentor, detail.slide.emotion);
          else if (detail.isLast) dialog.react('slidesEnd');
          else if (detail.slide.emotion) dialog.setEmotion(detail.slide.emotion);
        },
        'sg-slides-end': () => {
          store.completeSlides(id);
          toQuiz.hidden = false;
          updateTabs();
        },
      },
    });
    return h('section', { class: 'lesson__step', 'aria-label': 'Diák' }, slides, toQuiz);
  }

  function renderQuiz() {
    dialog.react('quizStart');
    const quiz = h('sg-quiz', {
      questions: lesson.quiz,
      on: {
        'sg-answer': ({ detail }) => {
          if (!detail.correct) dialog.react('wrong');
          else dialog.react(detail.streak >= CORRECT_STREAK_PRAISE ? 'correctStreak' : 'correct');
        },
        'sg-quiz-complete': ({ detail }) => showSummary(store.finishQuiz(id, detail)),
      },
    });
    return h('section', { class: 'lesson__step', 'aria-label': 'Kvíz' }, quiz);
  }

  function showSummary(result) {
    current = 'summary';
    dialog.react(result.perfect ? 'quizPerfect' : result.passed ? 'quizPassed' : 'quizFailed');
    const needed = Math.ceil(PASS_RATIO * result.total);
    const attempts = progress().quizAttempts;

    let xpNote = null;
    if (result.xpGained > 0) xpNote = h('p', { class: 'tag summary__xp' }, icon('gem'), `+${result.xpGained} XP`);
    else if (attempts > 1) xpNote = h('p', { class: 'summary__note' }, 'Új XP a korábbi legjobb eredményed javításáért jár.');

    const again = h('button', { class: result.passed ? 'btn btn--ghost-dark' : 'btn', type: 'button', onClick: () => go('quiz') }, 'Újra a kvízt');
    const toMap = h('button', { class: result.passed ? 'btn' : 'btn btn--ghost-dark', type: 'button', onClick: () => navigate('/map') }, 'Vissza a térképre');

    const heading = h('h2', { class: 'summary__score', tabindex: '-1' }, `${result.correct} / ${result.total}`);
    stage.replaceChildren(
      h(
        'section',
        { class: 'lesson__step summary panel', 'aria-label': 'Eredmény' },
        icon('trophy', { className: result.passed ? 'summary__icon is-passed' : 'summary__icon' }),
        h('p', { class: 'kicker' }, result.passed ? 'Lecke teljesítve' : 'Még egy próba?'),
        heading,
        h('p', { class: 'summary__label' }, 'helyes válasz'),
        xpNote,
        !result.passed && h('p', { class: 'summary__note' }, `A lecke teljesítéséhez legalább ${needed} helyes válasz kell.`),
        h('div', { class: 'actions summary__actions' }, again, toMap),
      ),
    );
    scroller.scrollTop = 0;
    heading.focus({ preventScroll: true });
    updateTabs();
  }

  go(resumeStep(progress()));
}

/** Folytatás ott, ahol a tanuló abbahagyta; teljesített leckénél az elejéről. */
function resumeStep(p) {
  if (p.completedAt) return 'video';
  if (p.slidesDone) return 'quiz';
  if (p.videoDone) return 'slides';
  return 'video';
}

/** Zárt, hiányzó vagy még készülő lecke: a karakter elmondja, mi a helyzet. */
function renderMessage(root, { character, event, title, kicker }) {
  const dialog = h('sg-dialog', { character });
  root.append(
    h(
      'main',
      { class: 'screen lesson' },
      h('sg-hud', { back: '#/map', 'back-label': 'Vissza a térképre' }),
      h(
        'div',
        { class: 'screen__scroll grid-bg' },
        h(
          'div',
          { class: 'container lesson__message' },
          kicker && h('p', { class: 'kicker' }, kicker),
          h('h1', { class: 'lesson__title', tabindex: '-1' }, title),
          dialog,
          h('a', { class: 'btn', href: '#/map' }, icon('arrowLeft'), 'Vissza a térképre'),
        ),
      ),
    ),
  );
  dialog.react(event);
}
