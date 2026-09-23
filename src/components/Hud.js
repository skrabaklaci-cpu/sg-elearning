import { h } from '../lib/dom.js';
import { store } from '../state/store.js';
import { displayedStreak, levelInfo } from '../state/progress.js';
import { icon } from './icons.js';
import './hud.css';

/**
 * <sg-hud back="#/subjects" back-label="Vissza a tárgyakhoz">
 *
 * Felső sáv: szint, XP-sáv, napi sorozat. Feliratkozik a store-ra, és XP-szerzéskor
 * felúszó „+10 XP” jelzést mutat.
 */
export class SgHud extends HTMLElement {
  #els = null;
  #cleanup = [];

  connectedCallback() {
    if (!this.#els) this.#build();
    this.#update(store.getState());
    this.#cleanup.push(
      store.subscribe((state) => this.#update(state)),
      store.on('xp', (event) => this.#floatXp(event.amount)),
    );
  }

  disconnectedCallback() {
    this.#cleanup.forEach((off) => off());
    this.#cleanup = [];
  }

  #build() {
    const els = {
      level: h('span', { class: 'hud__badge-num' }),
      label: h('span', { class: 'hud__label' }),
      fill: h('span', { class: 'hud__fill' }),
      bar: h('span', { class: 'hud__bar', role: 'progressbar', 'aria-valuemin': '0' }),
      streak: h('span', { class: 'hud__streak-count' }),
      streakBox: h('span', { class: 'hud__streak' }),
      floats: h('span', { class: 'hud__floats', 'aria-hidden': 'true' }),
    };
    els.bar.append(els.fill);
    els.streakBox.append(icon('flame'), els.streak);

    const back = this.getAttribute('back');
    this.append(
      h(
        'div',
        { class: 'hud container' },
        back &&
          h(
            'a',
            { class: 'btn btn--icon btn--ghost hud__back', href: back, 'aria-label': this.getAttribute('back-label') ?? 'Vissza' },
            icon('arrowLeft'),
          ),
        h('span', { class: 'hud__badge', 'aria-hidden': 'true' }, h('span', { class: 'hud__badge-lv' }, 'Szint'), els.level),
        h('span', { class: 'hud__main' }, els.label, els.bar, els.floats),
        els.streakBox,
      ),
    );
    this.#els = els;
  }

  #update(state) {
    const els = this.#els;
    const info = levelInfo(state.xp);
    const streak = displayedStreak(state.streak, store.today());

    els.level.textContent = String(info.level);
    els.label.replaceChildren(
      h('strong', null, info.title),
      h('span', { class: 'hud__xp' }, info.isMax ? ` · ${info.xp} XP` : ` · ${info.xpIntoLevel}/${info.xpForLevel} XP`),
    );
    els.label.setAttribute('aria-label', `${info.level}. szint, ${info.title}`);
    els.fill.style.width = `${Math.round(info.progress * 100)}%`;
    els.bar.setAttribute('aria-valuemax', String(info.xpForLevel || 1));
    els.bar.setAttribute('aria-valuenow', String(info.isMax ? 1 : info.xpIntoLevel));
    els.bar.setAttribute('aria-label', info.isMax ? 'Elérted a legmagasabb szintet' : `XP a következő szintig: ${info.xpIntoLevel} / ${info.xpForLevel}`);
    els.streak.textContent = String(streak);
    els.streakBox.classList.toggle('is-inactive', streak === 0);
    els.streakBox.setAttribute('aria-label', `${streak} napos sorozat`);
    els.streakBox.setAttribute('title', `${streak} napos sorozat`);
  }

  #floatXp(amount) {
    const tag = h('span', { class: 'hud__float' }, `+${amount} XP`);
    tag.addEventListener('animationend', () => tag.remove());
    this.#els.floats.append(tag);
  }
}

if (!customElements.get('sg-hud')) customElements.define('sg-hud', SgHud);
