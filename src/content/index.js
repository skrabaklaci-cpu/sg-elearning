// A tananyag betöltése a src/data/*.json fájlokból és ellenőrzése.
//
//  - világ (tárgy): minden olyan JSON, amelyben "type": "world" szerepel
//  - characters.json: a karakterek nevei, titulusai és reakció-mondatai
//  - intro.json: a kalauz bemutatkozó párbeszéde
//
// A validateContent() hibalistát ad; fejlesztés közben a konzolra írjuk, a tesztek pedig
// megakadályozzák, hogy hibás tartalom kerüljön ki.

import { CHARACTER_IDS } from '../config/characters.js';
import { EMOTIONS } from '../config/emotions.js';
import { format, pick } from '../lib/util.js';

const files = import.meta.glob('../data/*.json', { eager: true, import: 'default' });

function fileName(path) {
  return path.split('/').pop();
}

const data = {
  characters: files['../data/characters.json'] ?? {},
  intro: files['../data/intro.json'] ?? { lines: [] },
  worlds: Object.entries(files)
    .filter(([, json]) => json?.type === 'world')
    .map(([path, json]) => ({ ...json, file: fileName(path) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
};

// --- Lekérdezések --------------------------------------------------------------------------------

export function getWorlds() {
  return data.worlds;
}

export function getWorld(id) {
  return data.worlds.find((w) => w.id === id) ?? null;
}

/** @returns {{ world, lesson, index } | null} */
export function findLesson(lessonId) {
  for (const world of data.worlds) {
    const index = world.lessons.findIndex((l) => l.id === lessonId);
    if (index >= 0) return { world, lesson: world.lessons[index], index };
  }
  return null;
}

export function getIntro() {
  return data.intro;
}

/** @returns {{ name: string, role: string, lines: Record<string, string[]> }} */
export function getCharacterText(id) {
  const c = data.characters[id] ?? {};
  return { name: c.name ?? id, role: c.role ?? '', lines: c.lines ?? {} };
}

/** Véletlenszerű mondat a karaktertől az adott eseményre (vagy üres string, ha nincs ilyen). */
export function characterLine(id, event, vars) {
  const lines = getCharacterText(id).lines[event];
  if (!lines || lines.length === 0) return '';
  return format(pick(lines), vars);
}

// --- Ellenőrzés ------------------------------------------------------------------------------

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const YOUTUBE_ID = /^[\w-]{11}$/;

/** @returns {string[]} emberi nyelvű hibaüzenetek (üres tömb = minden rendben) */
export function validateContent(content = data) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  // Karakterek
  for (const id of CHARACTER_IDS) {
    const c = content.characters[id];
    if (!c) {
      err('characters.json', `hiányzik a(z) "${id}" karakter`);
      continue;
    }
    if (!isText(c.name)) err('characters.json', `"${id}": hiányzik a név`);
    for (const [event, lines] of Object.entries(c.lines ?? {})) {
      if (!Array.isArray(lines) || !lines.every(isText)) err('characters.json', `"${id}.lines.${event}": szövegek tömbje kell`);
    }
  }

  // Bemutatkozás
  if (!Array.isArray(content.intro.lines) || content.intro.lines.length === 0) {
    err('intro.json', 'a "lines" tömb üres vagy hiányzik');
  } else {
    content.intro.lines.forEach((line, i) => {
      if (!isText(line.text)) err('intro.json', `${i + 1}. sor: hiányzik a szöveg`);
      if (line.emotion && !(line.emotion in EMOTIONS)) err('intro.json', `${i + 1}. sor: ismeretlen érzelem "${line.emotion}"`);
    });
  }

  // Világok és leckék
  if (content.worlds.length === 0) err('data', 'nincs egyetlen világ ("type": "world") sem');
  const worldIds = new Set();
  const lessonIds = new Set();
  for (const world of content.worlds) {
    const where = world.file ?? world.id;
    if (!isText(world.id)) err(where, 'hiányzik az "id"');
    if (worldIds.has(world.id)) err(where, `ismétlődő világazonosító "${world.id}"`);
    worldIds.add(world.id);
    if (!isText(world.title)) err(where, 'hiányzik a "title"');
    if (!CHARACTER_IDS.includes(world.mentor)) err(where, `ismeretlen mentor "${world.mentor}"`);
    if (!Array.isArray(world.lessons) || world.lessons.length === 0) {
      err(where, 'nincs egyetlen lecke sem');
      continue;
    }
    world.lessons.forEach((lesson, i) => {
      const at = `${where} › ${lesson.id ?? `${i + 1}. lecke`}`;
      if (!/^[\w-]+$/.test(lesson.id ?? '')) err(at, 'az "id" csak betűt, számot, - és _ jelet tartalmazhat');
      if (lessonIds.has(lesson.id)) err(at, 'ismétlődő leckeazonosító');
      lessonIds.add(lesson.id);
      if (!isText(lesson.title)) err(at, 'hiányzik a "title"');
      if (lesson.comingSoon) return;
      validateLesson(lesson, at, err);
    });
  }
  return errors;
}

function validateLesson(lesson, at, err) {
  const id = lesson.video?.youtubeId;
  if (id && !YOUTUBE_ID.test(id)) err(at, `hibás YouTube-azonosító "${id}" (11 karakter, pl. a watch?v= utáni rész)`);

  if (!Array.isArray(lesson.slides) || lesson.slides.length === 0) err(at, 'nincs egyetlen dia sem');
  else {
    lesson.slides.forEach((slide, i) => {
      if (!isText(slide.title)) err(at, `${i + 1}. dia: hiányzik a "title"`);
      if (!isText(slide.body)) err(at, `${i + 1}. dia: hiányzik a "body"`);
      if (slide.emotion && !(slide.emotion in EMOTIONS)) err(at, `${i + 1}. dia: ismeretlen érzelem "${slide.emotion}"`);
    });
  }

  if (!Array.isArray(lesson.quiz) || lesson.quiz.length < 3 || lesson.quiz.length > 5) {
    err(at, 'a kvízben 3–5 kérdés legyen');
  }
  (lesson.quiz ?? []).forEach((q, i) => {
    if (!isText(q.question)) err(at, `${i + 1}. kérdés: hiányzik a "question"`);
    if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isText)) {
      err(at, `${i + 1}. kérdés: legalább 2 válaszlehetőség kell ("options")`);
    } else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      err(at, `${i + 1}. kérdés: az "answer" a helyes válasz sorszáma 0-tól (0–${q.options.length - 1})`);
    }
  });
}
