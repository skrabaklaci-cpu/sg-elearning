// Pixel art ikonok, inline SVG-ként. Színük a currentColor, így mindig az arculati színekből jön.
// Jelölés: '#' = currentColor, '+' = másodlagos szín (CSS: --icon-accent), '.' = átlátszó.

const NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  check: [
    '........',
    '......##',
    '.....###',
    '#...###.',
    '##.###..',
    '#####...',
    '.###....',
    '..#.....',
  ],
  cross: [
    '##....##',
    '###..###',
    '.######.',
    '..####..',
    '..####..',
    '.######.',
    '###..###',
    '##....##',
  ],
  lock: [
    '..####..',
    '.##..##.',
    '.#....#.',
    '.#....#.',
    '########',
    '###..###',
    '###..###',
    '########',
  ],
  hourglass: [
    '#######',
    '#+++++#',
    '.#+++#.',
    '..#+#..',
    '...#...',
    '..#.#..',
    '.#.+.#.',
    '#.+++.#',
    '#######',
  ],
  flame: [
    '...#....',
    '...##...',
    '..###...',
    '..####.#',
    '.#######',
    '.###+###',
    '##++++##',
    '##++++##',
    '.##++##.',
    '..####..',
  ],
  star: [
    '....#....',
    '...###...',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..#####..',
    '.###.###.',
    '.##...##.',
  ],
  gem: [
    '..#####..',
    '.##+#+##.',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  play: [
    '##.....',
    '####...',
    '######.',
    '#######',
    '#######',
    '######.',
    '####...',
    '##.....',
  ],
  arrowRight: [
    '...#...',
    '...##..',
    '######.',
    '#######',
    '######.',
    '...##..',
    '...#...',
  ],
  arrowLeft: [
    '...#...',
    '..##...',
    '.######',
    '#######',
    '.######',
    '..##...',
    '...#...',
  ],
  tv: [
    '..#....#..',
    '...#..#...',
    '##########',
    '#++++++++#',
    '#++++++++#',
    '#++++++++#',
    '#++++++++#',
    '##########',
    '.#......#.',
  ],
  book: [
    '.###..###.',
    '#+++##+++#',
    '#+++##+++#',
    '#+++##+++#',
    '#+++##+++#',
    '#+++##+++#',
    '.###..###.',
    '....##....',
  ],
  question: [
    '.####.',
    '##..##',
    '....##',
    '...##.',
    '..##..',
    '..##..',
    '......',
    '..##..',
    '..##..',
  ],
  trophy: [
    '.########.',
    '##.####.##',
    '##.####.##',
    '.#.####.#.',
    '...####...',
    '....##....',
    '....##....',
    '...####...',
    '..######..',
  ],
};

/** Az adott karakter vízszintes futamaiból épített SVG path. */
function runs(rows, char) {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== char) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === char) end++;
      d += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return d;
}

/**
 * @param {keyof typeof ICONS} name
 * @param {{ label?: string, className?: string }} [options] `label` nélkül az ikon dekoráció (aria-hidden)
 */
export function icon(name, { label, className } = {}) {
  const rows = ICONS[name];
  if (!rows) throw new Error(`Ismeretlen ikon: ${name}`);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('class', ['icon', `icon--${name}`, className].filter(Boolean).join(' '));
  svg.setAttribute('focusable', 'false');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const [char, cls] of [['#', null], ['+', 'icon__accent']]) {
    const d = runs(rows, char);
    if (!d) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    if (cls) path.setAttribute('class', cls);
    svg.append(path);
  }
  return svg;
}

export const ICON_NAMES = Object.keys(ICONS);
