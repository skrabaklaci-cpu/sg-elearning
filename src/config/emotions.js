// Érzelmek a sprite sheetekben.
//
// Mind a négy sheet 3×3-as rács, és ugyanebben a sorrendben tartalmazza az érzelmeket.
// A tömb pontosan úgy néz ki, mint a kép: 1. sor = felső sor, balról jobbra.
// Ha más a sorrend, csak ezt a tömböt kell átírni: a kód mindenhol az érzelem nevét használja.
export const EMOTION_GRID = [
  ['neutral', 'happy', 'joyful'],
  ['confident', 'thinking', 'surprised'],
  ['sad', 'nervous', 'angry'],
];

/** Magyar leírás az akadálymentes címkékhez (pl. „Zsófi, gondolkodik”). */
export const EMOTION_LABELS = {
  neutral: 'nyugodt',
  happy: 'mosolyog',
  joyful: 'nevet',
  confident: 'magabiztos',
  thinking: 'gondolkodik',
  surprised: 'meglepődött',
  sad: 'szomorú',
  nervous: 'izgul',
  angry: 'szigorú',
};

export const DEFAULT_EMOTION = 'neutral';

/** név → { row, col } */
export const EMOTIONS = Object.fromEntries(
  EMOTION_GRID.flatMap((names, row) => names.map((name, col) => [name, { row, col }])),
);

export const EMOTION_NAMES = Object.keys(EMOTIONS);

/**
 * Melyik esemény melyik érzelmet váltja ki. Tömb esetén véletlenszerűen választunk.
 * Az eseményekhez tartozó mondatok a src/data/characters.json `lines` mezőjében vannak.
 */
export const REACTIONS = {
  idle: 'neutral',
  greet: 'happy',
  welcomeBack: 'happy',
  videoIntro: 'happy',
  videoSoon: 'confident',
  slidesIntro: 'thinking',
  slidesEnd: 'confident',
  quizStart: 'confident',
  correct: ['happy', 'joyful'],
  correctStreak: 'joyful',
  wrong: ['sad', 'nervous'],
  quizPerfect: 'joyful',
  quizPassed: 'happy',
  quizFailed: 'nervous',
  locked: 'angry',
  soon: 'thinking',
  levelUp: 'joyful',
  streak: 'joyful',
  streakStart: 'happy',
};

export function emotionFor(event) {
  const reaction = REACTIONS[event];
  const pickFrom = Array.isArray(reaction) ? reaction : [reaction];
  const choice = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  return choice in EMOTIONS ? choice : DEFAULT_EMOTION;
}
