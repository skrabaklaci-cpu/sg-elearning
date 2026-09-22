import { h, richText } from '../lib/dom.js';
import { icon } from './icons.js';
import './quiz.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * <sg-quiz> — feleletválasztós kvíz, kérdésenként.
 *
 * Bemenet: `questions` property ([{ question, options, answer, explanation? }])
 * Események:
 *  - 'sg-answer'        { index, correct, streak }  (streak = egymás utáni helyes válaszok)
 *  - 'sg-quiz-complete' { correct, total, answers }
 *
 * A helyes/hibás jelzés nem csak színnel történik: ikon, felirat és áthúzás is jelzi.
 */
export class SgQuiz extends HTMLElement {
  #questions = [];
  #index = 0;
  #correct = 0;
  #streak = 0;
  #answers = [];

  set questions(value) {
    this.#questions = Array.isArray(value) ? value : [];
    this.restart();
  }

  get questions() {
    return this.#questions;
  }

  connectedCallback() {
    if (!this.hasChildNodes()) this.#render();
  }

  restart() {
    this.#index = 0;
    this.#correct = 0;
    this.#streak = 0;
    this.#answers = [];
    if (this.isConnected) this.#render();
  }

  #render({ focus = false } = {}) {
    const q = this.#questions[this.#index];
    if (!q) return;
    const total = this.#questions.length;
    const isLastQuestion = this.#index === total - 1;

    const feedback = h('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    const next = h(
      'button',
      { class: 'btn btn--block quiz__next', type: 'button', hidden: true, onClick: () => this.#advance() },
      isLastQuestion ? 'Eredmény' : 'Következő kérdés',
      icon('arrowRight'),
    );
    const buttons = q.options.map((text, i) =>
      h(
        'button',
        { class: 'quiz__option', type: 'button', onClick: () => this.#answer(i, q, buttons, feedback, next) },
        h('span', { class: 'quiz__key', 'aria-hidden': 'true' }, LETTERS[i] ?? String(i + 1)),
        h('span', { class: 'quiz__option-text' }, text),
        h('span', { class: 'quiz__mark' }),
      ),
    );
    const question = h('h3', { class: 'quiz__question', tabindex: '-1' }, q.question);

    this.replaceChildren(
      h(
        'section',
        { class: 'quiz panel', 'aria-label': 'Kvíz' },
        h(
          'div',
          { class: 'quiz__top' },
          h('p', { class: 'kicker' }, `${this.#index + 1}. kérdés / ${total}`),
          h('span', { class: 'quiz__pips', 'aria-hidden': 'true' }, this.#pips()),
        ),
        question,
        h('ol', { class: 'quiz__options' }, buttons.map((b) => h('li', null, b))),
        feedback,
        next,
      ),
    );
    if (focus) question.focus({ preventScroll: false });
  }

  #pips() {
    return this.#questions.map((_, i) => {
      const answer = this.#answers[i];
      let state = 'is-todo';
      if (answer) state = answer.correct ? 'is-correct' : 'is-wrong';
      else if (i === this.#index) state = 'is-current';
      return h('span', { class: ['quiz__pip', state] });
    });
  }

  #answer(choice, q, buttons, feedback, next) {
    if (this.#answers[this.#index]) return;
    const correct = choice === q.answer;
    this.#answers[this.#index] = { question: this.#index, choice, correct };
    this.#streak = correct ? this.#streak + 1 : 0;
    if (correct) this.#correct += 1;

    buttons.forEach((button, i) => {
      button.disabled = true;
      const mark = button.querySelector('.quiz__mark');
      if (i === q.answer) {
        button.classList.add('is-answer');
        mark.replaceChildren(icon('check'), h('span', { class: 'sr-only' }, ' – helyes válasz'));
      } else if (i === choice) {
        button.classList.add('is-wrong');
        mark.replaceChildren(icon('cross'), h('span', { class: 'sr-only' }, ' – a te válaszod, hibás'));
      } else {
        button.classList.add('is-dimmed');
      }
      if (i === choice) button.classList.add('is-chosen');
    });

    feedback.replaceChildren(
      h(
        'div',
        { class: ['quiz__result', correct ? 'is-correct' : 'is-wrong'] },
        icon(correct ? 'check' : 'cross', { className: 'quiz__result-icon' }),
        h(
          'div',
          { class: 'quiz__result-body' },
          h('p', { class: 'quiz__result-title' }, correct ? 'Helyes!' : 'Nem egészen.'),
          q.explanation && h('div', { class: 'quiz__explanation' }, richText(q.explanation)),
        ),
      ),
    );
    this.querySelector('.quiz__pips')?.replaceChildren(...this.#pips());
    next.hidden = false;
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    this.dispatchEvent(new CustomEvent('sg-answer', { detail: { index: this.#index, correct, streak: this.#streak } }));
  }

  #advance() {
    if (this.#index < this.#questions.length - 1) {
      this.#index += 1;
      this.#render({ focus: true });
      return;
    }
    this.dispatchEvent(
      new CustomEvent('sg-quiz-complete', {
        detail: { correct: this.#correct, total: this.#questions.length, answers: [...this.#answers] },
      }),
    );
  }
}

if (!customElements.get('sg-quiz')) customElements.define('sg-quiz', SgQuiz);
