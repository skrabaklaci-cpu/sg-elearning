import { h } from '../lib/dom.js';
import { icon } from './icons.js';
import './video.css';

const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * <sg-video video-id="dQw4w9WgXcQ" video-title="…">
 *
 * Adatvédelmi okból (kiskorú felhasználók) a YouTube-lejátszó csak kattintásra töltődik be,
 * a youtube-nocookie.com domainről. Előtte csak egy saját, arculati kártya látszik.
 * Azonosító nélkül „hamarosan érkezik” kártyát mutat.
 *
 * Esemény: 'sg-video-play' (buborékol), amikor a felhasználó elindítja a videót.
 */
export class SgVideo extends HTMLElement {
  static observedAttributes = ['video-id', 'video-title'];

  #played = false;

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  get played() {
    return this.#played;
  }

  get hasVideo() {
    return YOUTUBE_ID.test(this.#id());
  }

  #id() {
    return (this.getAttribute('video-id') ?? '').trim();
  }

  #title() {
    return this.getAttribute('video-title') || 'Videó';
  }

  #render() {
    const title = this.#title();
    if (!this.hasVideo) {
      this.replaceChildren(
        h(
          'div',
          { class: 'video__frame video__frame--empty' },
          icon('tv', { className: 'video__tv' }),
          h('p', { class: 'video__heading' }, 'A videó hamarosan érkezik'),
          h('p', { class: 'video__subtitle' }, title),
        ),
      );
      return;
    }
    this.replaceChildren(
      h(
        'button',
        { class: 'video__frame video__facade', type: 'button', onClick: () => this.#play() },
        h('span', { class: 'video__play', 'aria-hidden': 'true' }, icon('play')),
        h('span', { class: 'video__heading' }, 'Videó lejátszása'),
        h('span', { class: 'video__subtitle' }, title),
        h('span', { class: 'video__note' }, 'A lejátszó a YouTube-ról töltődik be.'),
      ),
    );
  }

  #play() {
    const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
    const iframe = h('iframe', {
      class: 'video__iframe',
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.#id())}?${params}`,
      title: this.#title(),
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    this.replaceChildren(h('div', { class: 'video__frame video__frame--playing' }, iframe));
    this.#played = true;
    this.dispatchEvent(new CustomEvent('sg-video-play', { bubbles: true }));
  }
}

if (!customElements.get('sg-video')) customElements.define('sg-video', SgVideo);
