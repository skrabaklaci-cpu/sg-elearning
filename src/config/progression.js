// Játékszabályok. Minden XP-, szint- és teljesítési szám itt van, a kódban máshol nem.

/**
 * XP-jutalmak. Mindegyik leckénként csak egyszer jár, így az ismétlésből nem lehet XP-t „farmolni”.
 * A kvíznél a helyes válaszokért csak a korábbi legjobb eredmény fölötti rész jár.
 */
export const XP_REWARDS = {
  video: 10, // a videó elindítása, majd továbblépés
  slides: 15, // az összes dia végignézése
  correctAnswer: 10, // helyes válaszonként
  perfectQuiz: 20, // az első hibátlan kvíz
  lessonComplete: 25, // a lecke első teljesítése
};

/** A lecke teljesítéséhez (és a következő feloldásához) szükséges helyes válaszarány, 0–1. */
export const PASS_RATIO = 0.5;

/** Ennyi egymást követő helyes válasz után a mentor külön megdicsér. */
export const CORRECT_STREAK_PRAISE = 3;

/** Szintek: a szint eléréséhez szükséges összes XP és a szint neve (a tömb sorrendje a szint száma). */
export const LEVELS = [
  { xp: 0, title: 'Újonc' },
  { xp: 50, title: 'Tanonc' },
  { xp: 120, title: 'Felfedező' },
  { xp: 210, title: 'Kalandor' },
  { xp: 320, title: 'Vándortudós' },
  { xp: 450, title: 'Mesterjelölt' },
  { xp: 600, title: 'Mester' },
  { xp: 780, title: 'Bölcs' },
  { xp: 1000, title: 'Legenda' },
];
