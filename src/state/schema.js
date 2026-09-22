// A mentett állapot szerkezete, alapértékei és migrációja.
//
// Szabályok:
//  - csak JSON-szerializálható adat (dátum 'YYYY-MM-DD' string)
//  - származtatott adatot nem mentünk (pl. a szintet az XP-ből számoljuk)
//  - sémaváltozáskor: SCHEMA_VERSION növelése + lépés a migrate()-ben

import { isDateString } from '../lib/date.js';

export const SCHEMA_VERSION = 1;

export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    xp: 0,
    streak: { count: 0, best: 0, lastActiveDate: null },
    /** leckeazonosító → haladás, lásd createLessonProgress() */
    lessons: {},
    flags: { introSeen: false },
    createdAt: null,
  };
}

export function createLessonProgress() {
  return {
    videoDone: false,
    slidesDone: false,
    quizBest: 0,
    quizTotal: 0,
    quizAttempts: 0,
    completedAt: null,
  };
}

/** Régebbi sémájú mentés felhozása az aktuálisra. */
function migrate(raw) {
  const data = { ...raw };
  // Példa a jövőre: if (data.version === 1) { …átalakítás…; data.version = 2; }
  return data;
}

/**
 * Bármilyen (hiányos, sérült, régi vagy idegen) adatból érvényes állapotot készít.
 * Az ismeretlen mezőket eldobja, a hiányzókat alapértékkel tölti ki.
 */
export function normalizeState(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const data = migrate(raw);

  return {
    version: SCHEMA_VERSION,
    xp: count(data.xp),
    streak: {
      count: count(data.streak?.count),
      best: Math.max(count(data.streak?.best), count(data.streak?.count)),
      lastActiveDate: isDateString(data.streak?.lastActiveDate) ? data.streak.lastActiveDate : null,
    },
    lessons: normalizeLessons(data.lessons),
    flags: { introSeen: data.flags?.introSeen === true },
    createdAt: isDateString(data.createdAt) ? data.createdAt : null,
  };
}

function normalizeLessons(lessons) {
  if (!lessons || typeof lessons !== 'object' || Array.isArray(lessons)) return {};
  const out = {};
  for (const [id, p] of Object.entries(lessons)) {
    if (!/^[\w-]{1,64}$/.test(id) || !p || typeof p !== 'object') continue;
    out[id] = {
      videoDone: p.videoDone === true,
      slidesDone: p.slidesDone === true,
      quizBest: count(p.quizBest),
      quizTotal: count(p.quizTotal),
      quizAttempts: count(p.quizAttempts),
      completedAt: isDateString(p.completedAt) ? p.completedAt : null,
    };
  }
  return out;
}

/** Nemnegatív egész, vagy 0. */
function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
