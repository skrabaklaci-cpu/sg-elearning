import { h } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/util.js';
import './speech-bubble.css';

const CHAR_DELAY = 18;
const PAUSES = { '.': 170, '!': 170, '?': 170, '…': 220, ',': 90, ':': 90, '–': 70 };

/**
 * <sg-speech-bubble speaker="Zsófi" tail="left|top|bottom">
 *
 * Beszédbuborék írógép-effektussal.
 *  - say(text) → Promise, ami a kiírás végén teljesül
 *  - skip(): azonnal kiírja a teljes szöveget (a buborékra kattintás is ezt teszi)
 *
 * A teljes szöveg rögtön bekerül egy láthatatlan aria-live régióba, így a képernyőolvasó
 * nem betűnként olvassa fel. A buborék mérete a teljes szöveghez igazodik, nem ugrál gépelés közben.
 */
export class SgSpeechBubble extends HTMLElement {
  static observedAttributes = ['speaker'];

  #name = null;
  #ghost = null;
  #typed = null;
  #live = null;
  #timer = null;
  #full = '';
  #resolve = null;

  connectedCallback() {
    this.#ensure();
  }

  disconnectedCallback() {
    this.#finish();
  }

  attributeChangedCallback() {
    this.#updateName();
  }

  get typing() {
    return this.#timer !== null;
  }

  get text() {
    return this.#full;
  }

  say(text, { instant = false } = {}) {
    this.#ensure();
    this.#finish();
    this.#full = String(text ?? '');
    this.#ghost.textContent = this.#full;
    this.#live.textContent = this.#full;
    this.classList.remove('is-done');

    if (instant || !this.#full || prefersReducedMotion()) {
      this.#finish();
      return Promise.resolve();
    }
    this.#typed.textContent = '';
    return new Promise((resolve) => {
      this.#resolve = resolve;
      let i = 0;
      const step = () => {
        i += 1;
        this.#typed.textContent = this.#full.slice(0, i);
        if (i >= this.#full.length) {
          this.#finish();
          return;
        }
        this.#timer = setTimeout(step, PAUSES[this.#full[i - 1]] ?? CHAR_DELAY);
      };
      this.#timer = setTimeout(step, CHAR_DELAY);
    });
  }

  skip() {
    if (this.typing) this.#finish();
  }

  #finish() {
    clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#typed) this.#typed.textContent = this.#full;
    this.classList.add('is-done');
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.();
  }

  #ensure() {
    if (this.#typed) return;
    this.#name = h('span', { class: 'bubble__name' });
    this.#ghost = h('span', { class: 'bubble__ghost' });
    this.#typed = h('span', { class: 'bubble__typed' });
    this.#live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    this.append(
      h('span', { class: 'bubble__tail', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'bubble__box' },
        this.#name,
        h('p', { class: 'bubble__text', 'aria-hidden': 'true' }, this.#ghost, this.#typed),
        this.#live,
      ),
    );
    this.addEventListener('click', () => this.skip());
    this.#updateName();
  }

  #updateName() {
    if (!this.#name) return;
    const speaker = this.getAttribute('speaker');
    this.#name.textContent = speaker ?? '';
    this.#name.hidden = !speaker;
  }
}

if (!customElements.get('sg-speech-bubble')) customElements.define('sg-speech-bubble', SgSpeechBubble);
