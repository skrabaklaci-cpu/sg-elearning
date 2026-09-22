import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../config/characters.js';
import { findLesson, getWorlds, validateContent } from './index.js';

describe('tananyag (src/data)', () => {
  it('nincs benne hiba', () => {
    expect(validateContent()).toEqual([]);
  });

  it('három világ van, mindegyiknek saját mentora', () => {
    const worlds = getWorlds();
    expect(worlds.map((w) => w.id)).toEqual(['math', 'history', 'economics']);
    for (const world of worlds) expect(CHARACTER_IDS).toContain(world.mentor);
  });

  it('minden világban van legalább egy kész lecke', () => {
    for (const world of getWorlds()) {
      expect(world.lessons.some((l) => !l.comingSoon)).toBe(true);
    }
  });

  it('a leckék azonosító alapján megtalálhatók', () => {
    expect(findLesson('math-01')?.world.id).toBe('math');
    expect(findLesson('nincs-ilyen')).toBeNull();
  });

  it('a validátor jelzi a tipikus szerkesztési hibákat', () => {
    const errors = validateContent({
      characters: {},
      intro: { lines: [{ text: 'Szia', emotion: 'boldog' }] },
      worlds: [
        {
          file: 'teszt.json',
          id: 'x',
          title: 'Teszt',
          mentor: 'senki',
          lessons: [
            {
              id: 'x-1',
              title: 'Lecke',
              video: { youtubeId: 'túl-rövid' },
              slides: [{ title: 'Dia', body: 'Szöveg', emotion: 'boldog' }],
              quiz: [{ question: 'K?', options: ['a', 'b'], answer: 2 }],
            },
          ],
        },
      ],
    });
    const text = errors.join('\n');
    expect(text).toMatch(/hiányzik a\(z\) "guide" karakter/);
    expect(text).toMatch(/ismeretlen érzelem "boldog"/);
    expect(text).toMatch(/ismeretlen mentor "senki"/);
    expect(text).toMatch(/hibás YouTube-azonosító/);
    expect(text).toMatch(/3–5 kérdés/);
    expect(text).toMatch(/"answer"/);
  });
});
