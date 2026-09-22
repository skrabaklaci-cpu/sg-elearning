import { emotionFor } from '../config/emotions.js';
import { characterLine, getCharacterText } from '../content/index.js';
import { h } from '../lib/dom.js';
import { prefersReducedMotion, wait } from '../lib/util.js';
import './level-up.css';

const CONFETTI = 14;

/**
 * <sg-level-up> — teljes képernyős szintlépés-animáció a kalauzzal.
 *
 * show({ from, to, title }) → Promise, ami bezáráskor teljesül. Több szintlépés sorba áll.
 * Megnyitáskor/záráskor 'sg-overlay' eseményt küld a document-re (detail.open), hogy más
 * felugró elemek (pl. a toast) kivárhassanak.
 */
export class SgLevelUp extends HTMLElement {
  #queue = [];
  #active = null;
  #els = null;
  #returnFocus = null;

  connectedCallback() {
    if (!this.#els) this.#build();
    this.hidden = true;
  }

  show(event) {
    return new Promise((resolve) => {
      this.#queue.push({ event, resolve });
      if (!this.#active) this.#next();
    });
  }

  async #next() {
    const item = this.#queue.shift();
    if (!item) return;
    this.#active = item;
    // Hagyunk időt, hogy az XP-sáv feltöltődése még látsszon.
    if (!prefersReducedMotion()) await wait(650);

    const { from, to, title } = item.event;
    const els = this.#els;
    els.from.textContent = `${from}. szint`;
    els.to.textContent = `${to}. szint`;
    els.title.textContent = title ?? '';

    this.#returnFocus = document.activeElement;
    this.hidden = false;
    this.classList.remove('is-open');
    void this.offsetWidth;
    this.classList.add('is-open');
    document.dispatchEvent(new CustomEvent('sg-overlay', { detail: { open: true } }));

    els.character.setAttribute('emotion', emotionFor('levelUp'));
    els.bubble.say(characterLine('guide', 'levelUp'));
    els.button.focus({ preventScroll: true });
  }

  #close() {
    if (!this.#active) return;
    const { resolve } = this.#active;
    this.#active = null;
    this.hidden = true;
    this.classList.remove('is-open');
    document.dispatchEvent(new CustomEvent('sg-overlay', { detail: { open: false } }));
    if (this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    resolve();
    if (this.#queue.length) this.#next();
  }

  #build() {
    const els = {
      from: h('span', { class: 'levelup__from' }),
      to: h('span', { class: 'levelup__to' }),
      title: h('p', { class: 'levelup__title' }),
      character: h('sg-character', { character: 'guide', emotion: 'joyful', 'max-scale': '4' }),
      bubble: h('sg-speech-bubble', { speaker: getCharacterText('guide').name, tail: 'top' }),
      button: h('button', { class: 'btn btn--block', type: 'button', onClick: () => this.#close() }, 'Szuper!'),
    };
    const confetti = h(
      'div',
      { class: 'levelup__confetti', 'aria-hidden': 'true' },
      Array.from({ length: CONFETTI }, (_, i) =>
        h('span', {
          class: ['levelup__bit', i % 3 === 0 && 'is-light'],
          style: { '--x': `${(i * 37) % 100}%`, '--delay': `${(i % 7) * 90}ms`, '--fall': `${900 + (i % 5) * 160}ms` },
        }),
      ),
    );

    this.append(
      h('div', { class: 'levelup__backdrop' }),
      h(
        'div',
        {
          class: 'levelup__panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'levelup-heading',
          onKeydown: (e) => this.#onKey(e),
        },
        h('div', { class: 'levelup__rays', 'aria-hidden': 'true' }),
        confetti,
        h('p', { class: 'levelup__kicker pixel-title', id: 'levelup-heading' }, 'Szintlépés!'),
        h('div', { class: 'levelup__stage' }, els.character),
        h('p', { class: 'levelup__levels' }, els.from, h('span', { class: 'levelup__arrow', 'aria-hidden': 'true' }, '→'), els.to),
        els.title,
        els.bubble,
        els.button,
      ),
    );
    this.#els = els;
  }

  #onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.#close();
    } else if (event.key === 'Tab') {
      // Egyetlen fókuszálható elem van: a fókusz a gombon marad.
      event.preventDefault();
      this.#els.button.focus();
    }
  }
}

if (!customElements.get('sg-level-up')) customElements.define('sg-level-up', SgLevelUp);
