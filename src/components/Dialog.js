import { emotionFor } from '../config/emotions.js';
import { characterLine, getCharacterText } from '../content/index.js';
import { h } from '../lib/dom.js';
import './dialog.css';

/**
 * <sg-dialog character="math">
 *
 * RPG-párbeszédablak: a karakter portréja és a beszédbuboréka.
 *  - say(text, emotion?)  kiír egy mondatot (és opcionálisan érzelmet vált)
 *  - react(event, vars?)  az eseményhez tartozó érzelem (config/emotions.js REACTIONS)
 *                         és mondat (data/characters.json) együtt
 *  - setEmotion(emotion)
 */
export class SgDialog extends HTMLElement {
  #portrait = null;
  #bubble = null;

  connectedCallback() {
    this.#ensure();
  }

  get character() {
    return this.getAttribute('character');
  }

  setEmotion(emotion) {
    this.#ensure();
    if (emotion) this.#portrait.setAttribute('emotion', emotion);
  }

  say(text, emotion) {
    this.#ensure();
    this.setEmotion(emotion);
    return this.#bubble.say(text);
  }

  react(event, vars) {
    this.#ensure();
    this.setEmotion(emotionFor(event));
    const line = characterLine(this.character, event, vars);
    return line ? this.#bubble.say(line) : Promise.resolve();
  }

  skip() {
    this.#bubble?.skip();
  }

  #ensure() {
    if (this.#bubble) return;
    const id = this.character;
    this.#portrait = h('sg-character', { character: id, emotion: 'neutral', crop: 'portrait', 'max-scale': '2' });
    this.#bubble = h('sg-speech-bubble', { speaker: getCharacterText(id).name, tail: 'left' });
    this.append(h('div', { class: 'dialog__portrait' }, this.#portrait), this.#bubble);
  }
}

if (!customElements.get('sg-dialog')) customElements.define('sg-dialog', SgDialog);
