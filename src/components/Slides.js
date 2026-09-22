import { h, richText } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/util.js';
import { icon } from './icons.js';
import './slides.css';

const SWIPE_THRESHOLD = 48;

/**
 * <sg-slides> — dia-kártyák egyenként, gombokkal, nyilakkal és húzással lapozva.
 *
 * Bemenet: `slides` property ([{ title, body, emotion?, mentor? }])
 * Események:
 *  - 'sg-slide-change' { index, slide, isLast }
 *  - 'sg-slides-end'   az utolsó dia első elérésekor
 */
export class SgSlides extends HTMLElement {
  #slides = [];
  #index = 0;
  #reachedEnd = false;
  #els = null;
  #pointerX = null;

  set slides(value) {
    this.#slides = Array.isArray(value) ? value : [];
    this.#index = 0;
    this.#reachedEnd = false;
    if (this.isConnected) this.#build();
  }

  get slides() {
    return this.#slides;
  }

  get index() {
    return this.#index;
  }

  connectedCallback() {
    if (!this.#els) this.#build();
  }

  go(index) {
    if (index < 0 || index >= this.#slides.length || index === this.#index) return;
    const direction = index > this.#index ? 1 : -1;
    this.#index = index;
    this.#show(direction);
  }

  #build() {
    const card = h('article', { class: 'slides__card panel', tabindex: '-1', 'aria-roledescription': 'dia' });
    const prev = h(
      'button',
      { class: 'btn btn--icon btn--light', type: 'button', 'aria-label': 'Előző dia', onClick: () => this.go(this.#index - 1) },
      icon('arrowLeft'),
    );
    const next = h(
      'button',
      { class: 'btn btn--icon', type: 'button', 'aria-label': 'Következő dia', onClick: () => this.go(this.#index + 1) },
      icon('arrowRight'),
    );
    const dots = h('span', { class: 'slides__dots', 'aria-hidden': 'true' }, this.#slides.map(() => h('span', { class: 'slides__dot' })));
    const counter = h('span', { class: 'slides__counter' });
    const viewport = h('div', { class: 'slides__viewport' }, card);

    viewport.addEventListener('pointerdown', (e) => {
      this.#pointerX = e.clientX;
    });
    viewport.addEventListener('pointerup', (e) => {
      if (this.#pointerX === null) return;
      const dx = e.clientX - this.#pointerX;
      this.#pointerX = null;
      if (Math.abs(dx) >= SWIPE_THRESHOLD) this.go(this.#index + (dx < 0 ? 1 : -1));
    });
    viewport.addEventListener('pointercancel', () => {
      this.#pointerX = null;
    });

    this.replaceChildren(
      h('section', { class: 'slides', 'aria-roledescription': 'diasor', 'aria-label': 'Diák', onKeydown: (e) => this.#onKey(e) },
        viewport,
        h('div', { class: 'slides__nav' }, prev, h('span', { class: 'slides__meta' }, dots, counter), next),
      ),
    );
    this.#els = { card, prev, next, dots, counter };
    this.#show(0);
  }

  #onKey(event) {
    if (event.key === 'ArrowRight') this.go(this.#index + 1);
    else if (event.key === 'ArrowLeft') this.go(this.#index - 1);
    else return;
    event.preventDefault();
  }

  #show(direction) {
    const { card, prev, next, dots, counter } = this.#els;
    const slide = this.#slides[this.#index];
    const total = this.#slides.length;
    if (!slide) return;
    const isLast = this.#index === total - 1;

    card.replaceChildren(
      h('p', { class: 'kicker slides__kicker' }, `${this.#index + 1}. dia`),
      h('h3', { class: 'slides__title' }, slide.title),
      h('div', { class: 'slides__body' }, richText(slide.body)),
    );
    card.setAttribute('aria-label', `${this.#index + 1}. dia (összesen ${total}): ${slide.title}`);
    card.classList.remove('is-from-left', 'is-from-right');
    if (direction && !prefersReducedMotion()) {
      void card.offsetWidth;
      card.classList.add(direction > 0 ? 'is-from-right' : 'is-from-left');
    }

    // Ha a most letiltott gombon volt a fókusz, a kártyára tesszük, hogy ne vesszen el.
    const focused = document.activeElement;
    prev.disabled = this.#index === 0;
    next.disabled = isLast;
    if ((focused === prev || focused === next) && focused.disabled) card.focus({ preventScroll: true });

    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('is-current', i === this.#index);
      dot.classList.toggle('is-seen', i < this.#index);
    });
    counter.textContent = `${this.#index + 1} / ${total}`;

    this.dispatchEvent(new CustomEvent('sg-slide-change', { detail: { index: this.#index, slide, isLast } }));
    if (isLast && !this.#reachedEnd) {
      this.#reachedEnd = true;
      this.dispatchEvent(new CustomEvent('sg-slides-end'));
    }
  }
}

if (!customElements.get('sg-slides')) customElements.define('sg-slides', SgSlides);
