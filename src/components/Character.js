import { CHARACTERS } from '../config/characters.js';
import { DEFAULT_EMOTION, EMOTIONS, EMOTION_LABELS } from '../config/emotions.js';
import { getCharacterText } from '../content/index.js';
import { prefersReducedMotion } from '../lib/util.js';
import './character.css';

const DEFAULT_MAX_SCALE = 8;

/**
 * <sg-character character="math" emotion="happy" scale="auto" max-scale="3" crop="portrait">
 *
 * Egy karakter egy érzelme a 3×3-as sprite sheetből, CSS background-position-nel.
 *  - scale: egész szám (1, 2, 3…), vagy "auto" (alapértelmezés): a legnagyobb egész nagyítás,
 *    amivel a karakter még befér az elem helyére. Auto módban az elemnek méretet kell kapnia
 *    a szülőtől (pl. height: 100%), a karakter alul, középen áll.
 *  - max-scale: az auto mód felső határa
 *  - crop="portrait": csak a cella felső része (fej és váll) látszik
 *
 * Tört nagyítás soha nincs: a pixelek mindig élesek (image-rendering: pixelated).
 */
export class SgCharacter extends HTMLElement {
  static observedAttributes = ['character', 'emotion', 'scale', 'max-scale', 'crop'];

  #sprite = null;
  #observer = null;
  #box = null;
  #scale = 1;

  connectedCallback() {
    if (!this.#sprite) {
      this.#sprite = document.createElement('span');
      this.#sprite.className = 'sg-character__sprite';
      this.append(this.#sprite);
    }
    this.setAttribute('role', 'img');
    this.#observe();
    this.#render();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#sprite) return;
    if (name === 'scale') this.#observe();
    this.#render();
    if (name === 'emotion' && oldValue !== null) this.#hop();
  }

  get emotion() {
    return this.getAttribute('emotion') ?? DEFAULT_EMOTION;
  }

  set emotion(value) {
    this.setAttribute('emotion', value);
  }

  /** Az aktuálisan használt (egész) nagyítás. */
  get scale() {
    return this.#scale;
  }

  #isAuto() {
    const value = this.getAttribute('scale');
    return value === null || value === 'auto';
  }

  #observe() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#box = null;
    if (!this.#isAuto() || !this.isConnected) return;
    this.#observer = new ResizeObserver(([entry]) => {
      this.#box = entry.contentRect;
      this.#render();
    });
    this.#observer.observe(this);
  }

  #render() {
    const ch = CHARACTERS[this.getAttribute('character')];
    if (!ch || !this.#sprite) return;
    const emotion = this.emotion in EMOTIONS ? this.emotion : DEFAULT_EMOTION;
    const { row, col } = EMOTIONS[emotion];
    const height = this.getAttribute('crop') === 'portrait' ? ch.portraitHeight : ch.cellHeight;
    const scale = this.#computeScale(ch.cellWidth, height);
    this.#scale = scale;

    const style = this.#sprite.style;
    style.width = `${ch.cellWidth * scale}px`;
    style.height = `${height * scale}px`;
    style.backgroundImage = `url("${ch.sheetUrl}")`;
    style.backgroundSize = `${ch.cellWidth * ch.columns * scale}px ${ch.cellHeight * ch.rows * scale}px`;
    style.backgroundPosition = `${-col * ch.cellWidth * scale}px ${-row * ch.cellHeight * scale}px`;
    style.setProperty('--art-px', `${scale}px`);
    // Egész pixelre igazított vízszintes középre állítás (a tört eltolás elmosná a pixeleket).
    style.left = this.#box ? `${Math.floor((this.#box.width - ch.cellWidth * scale) / 2)}px` : '';

    this.setAttribute('aria-label', `${getCharacterText(ch.id).name}, ${EMOTION_LABELS[emotion]}`);
  }

  #computeScale(width, height) {
    if (!this.#isAuto()) return Math.max(1, Number.parseInt(this.getAttribute('scale'), 10) || 1);
    if (!this.#box) return 1;
    const max = Math.max(1, Number.parseInt(this.getAttribute('max-scale'), 10) || DEFAULT_MAX_SCALE);
    const fit = Math.floor(Math.min(this.#box.width / width, this.#box.height / height));
    return Math.min(max, Math.max(1, fit));
  }

  /** Érzelemváltáskor egy apró, pixelnyi ugrás. */
  #hop() {
    if (prefersReducedMotion()) return;
    this.#sprite.classList.remove('is-hopping');
    void this.#sprite.offsetWidth; // újraindítja az animációt
    this.#sprite.classList.add('is-hopping');
  }
}

if (!customElements.get('sg-character')) customElements.define('sg-character', SgCharacter);
