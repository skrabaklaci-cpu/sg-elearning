import { h } from '../lib/dom.js';
import { wait } from '../lib/util.js';
import './toast.css';

/**
 * <sg-toast> — rövid, magától eltűnő üzenet egy karaktertől (pl. zárt lecke, napi sorozat).
 *
 * show({ character, emotion, text, duration }) — sorba állítja az üzeneteket, és kivár,
 * amíg egy teljes képernyős réteg (pl. szintlépés) nyitva van.
 */
export class SgToast extends HTMLElement {
  #queue = [];
  #busy = false;
  #overlayOpen = false;
  #region = null;

  #onOverlay = (event) => {
    this.#overlayOpen = Boolean(event.detail?.open);
    if (!this.#overlayOpen) this.#pump();
  };

  connectedCallback() {
    if (!this.#region) {
      this.#region = h('div', { class: 'toast__region', role: 'status', 'aria-live': 'polite' });
      this.append(this.#region);
    }
    document.addEventListener('sg-overlay', this.#onOverlay);
  }

  disconnectedCallback() {
    document.removeEventListener('sg-overlay', this.#onOverlay);
  }

  show({ character = 'guide', emotion = 'happy', text, duration = 3800 }) {
    if (!text) return;
    // Ugyanazt az üzenetet ne halmozzuk (pl. többször koppintott zárt lecke).
    if (this.#queue.some((item) => item.text === text)) return;
    this.#queue.push({ character, emotion, text, duration });
    this.#pump();
  }

  async #pump() {
    if (this.#busy || this.#overlayOpen) return;
    const item = this.#queue.shift();
    if (!item) return;
    this.#busy = true;

    const card = h(
      'div',
      { class: 'toast__card' },
      h('span', { class: 'toast__portrait' }, h('sg-character', { character: item.character, emotion: item.emotion, crop: 'portrait', scale: '1' })),
      h('p', { class: 'toast__text' }, item.text),
    );
    this.#region.replaceChildren(card);
    const closed = new Promise((resolve) => card.addEventListener('click', resolve, { once: true }));
    await Promise.race([wait(item.duration), closed]);
    card.classList.add('is-leaving');
    await wait(200);
    card.remove();
    this.#busy = false;
    this.#pump();
  }
}

if (!customElements.get('sg-toast')) customElements.define('sg-toast', SgToast);
