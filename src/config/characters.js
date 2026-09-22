// Karakterek technikai adatai: melyik sprite sheet, mekkora egy cella.
// A cellaméreteket az `npm run sprites` generálja (src/assets/sprites/sprites.json).
// A nevek és a szövegek tartalomnak számítanak: src/data/characters.json.

import manifest from '../assets/sprites/sprites.json';

const sheetUrls = import.meta.glob('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });

/** guide = fő kalauz; a többiek a tárgyi világok mentorai. */
export const CHARACTER_IDS = ['guide', 'math', 'history', 'economics'];

/**
 * A „portrait” kivágás magassága natív pixelben: a cella felső része (fej és váll), a szűkebb
 * helyekre (párbeszédablak, térkép). A cellák eltérő arányai miatt karakterenként állítjuk be.
 */
const PORTRAIT_HEIGHT = {
  guide: 66,
  math: 62,
  history: 84,
  economics: 80,
};

export const CHARACTERS = Object.fromEntries(
  CHARACTER_IDS.map((id) => {
    const sheet = manifest.sheets[id];
    if (!sheet) throw new Error(`Hiányzó sprite sheet: ${id}. Futtasd: npm run sprites`);
    return [
      id,
      {
        id,
        sheetUrl: sheetUrls[`../assets/sprites/${sheet.file}`],
        columns: sheet.columns,
        rows: sheet.rows,
        cellWidth: sheet.cellWidth,
        cellHeight: sheet.cellHeight,
        portraitHeight: Math.min(PORTRAIT_HEIGHT[id] ?? sheet.cellHeight, sheet.cellHeight),
      },
    ];
  }),
);
