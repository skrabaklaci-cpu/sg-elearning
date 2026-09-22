// Kis DOM-segédek. Tartalmat mindig szövegként (text node) szúrunk be, soha nem innerHTML-lel.

/**
 * Elem létrehozása:
 *   h('button', { class: 'btn', onClick: go, 'aria-label': 'Tovább' }, 'Tovább')
 *
 * - `class`: string vagy tömb (a hamis elemek kimaradnak)
 * - `style` / `dataset`: objektum
 * - `onClick` stb.: natív eseménykezelő; `on: { 'sg-answer': fn }`: tetszőleges (egyedi) esemény
 * - nem string érték (pl. tömb, szám, boolean) property-ként kerül az elemre, ha van ilyen property-je
 *   (pl. `hidden`, `disabled`, vagy egy custom element `questions` adata); különben attribútum lesz
 * - `null`, `undefined` és `false` érték kimarad
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      else if (key === 'style' && typeof value === 'object') setStyle(el, value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'on') for (const [type, fn] of Object.entries(value)) el.addEventListener(type, fn);
      else if (/^on[A-Z]/.test(key) && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (typeof value !== 'string' && key in el) el[key] = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  return append(el, children);
}

function setStyle(el, styles) {
  for (const [prop, value] of Object.entries(styles)) {
    if (value == null) continue;
    if (prop.startsWith('--')) el.style.setProperty(prop, String(value));
    else el.style[prop] = value;
  }
}

/** Gyerekek hozzáfűzése: tömböket kilapít, a null/false elemeket kihagyja, a többi text node lesz. */
export function append(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : String(child));
  }
  return parent;
}

/**
 * A JSON-tartalom szövegeinek egyszerű formázása, HTML nélkül:
 *   - üres sor: új bekezdés; sima sortörés: <br>
 *   - „• ” vagy „- ” kezdetű sorok: felsorolás
 *   - **félkövér**
 */
export function richText(text) {
  const frag = document.createDocumentFragment();
  for (const block of String(text ?? '').trim().split(/\n\s*\n/)) {
    let paragraph = null;
    let list = null;
    for (const line of block.split('\n')) {
      const bullet = line.match(/^\s*[•-]\s+(.*)$/);
      if (bullet) {
        paragraph = null;
        list ??= frag.appendChild(h('ul'));
        list.append(h('li', null, inline(bullet[1])));
      } else {
        list = null;
        if (paragraph) paragraph.append(h('br'));
        else paragraph = frag.appendChild(h('p'));
        append(paragraph, inline(line));
      }
    }
  }
  return frag;
}

function inline(line) {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? h('strong', null, part.slice(2, -2)) : part));
}
