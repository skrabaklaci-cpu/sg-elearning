// Játéklogika: XP, szintek, napi sorozat (streak), leckék feloldása.
// Csak tiszta függvények: bemenet az állapot (+ a mai nap), kimenet az új állapot és az események.
// Az események ({ type: 'xp' | 'levelup' | 'streak' | 'lesson-complete', … }) alapján a felület animál.

import { LEVELS, PASS_RATIO, SEQUENTIAL_LESSONS, XP_REWARDS } from '../config/progression.js';
import { daysBetween } from '../lib/date.js';
import { clamp } from '../lib/util.js';
import { createLessonProgress } from './schema.js';

// --- Szintek -----------------------------------------------------------------------------------

export function levelForXp(xp) {
  let level = 1;
  LEVELS.forEach((entry, i) => {
    if (xp >= entry.xp) level = i + 1;
  });
  return level;
}

export function levelTitle(level) {
  return LEVELS[clamp(level, 1, LEVELS.length) - 1].title;
}

/** Minden, ami a szint kijelzéséhez kell. */
export function levelInfo(xp) {
  const level = levelForXp(xp);
  const current = LEVELS[level - 1];
  const next = LEVELS[level] ?? null;
  const xpIntoLevel = xp - current.xp;
  const xpForLevel = next ? next.xp - current.xp : 0;
  return {
    level,
    title: current.title,
    xp,
    xpIntoLevel,
    xpForLevel,
    nextLevelXp: next ? next.xp : null,
    progress: next ? xpIntoLevel / xpForLevel : 1,
    isMax: !next,
  };
}

// --- Napi sorozat --------------------------------------------------------------------------------

/** Tanulási tevékenység regisztrálása a mai napra. Kihagyott nap után a sorozat 1-ről indul újra. */
export function registerActivity(streak, today) {
  const last = streak.lastActiveDate;
  if (last) {
    const gap = daysBetween(last, today);
    if (gap <= 0) return streak; // ma már volt (vagy visszaállt az óra): nincs változás
    const count = gap === 1 ? streak.count + 1 : 1;
    return { count, best: Math.max(streak.best, count), lastActiveDate: today };
  }
  return { count: 1, best: Math.max(streak.best, 1), lastActiveDate: today };
}

/** A kijelzendő sorozat: tegnapi aktivitással még él (ma meghosszabbítható), régebbivel már 0. */
export function displayedStreak(streak, today) {
  if (!streak.lastActiveDate) return 0;
  return daysBetween(streak.lastActiveDate, today) <= 1 ? streak.count : 0;
}

// --- Leckék --------------------------------------------------------------------------------------

export function getLessonProgress(state, lessonId) {
  return { ...createLessonProgress(), ...state.lessons[lessonId] };
}

export function isLessonCompleted(state, lessonId) {
  return Boolean(state.lessons[lessonId]?.completedAt);
}

export function isPassing(correct, total) {
  return total > 0 && correct / total >= PASS_RATIO;
}

/**
 * A világ leckéinek állapota sorrendben:
 *  'completed' teljesítve | 'available' indítható | 'locked' az előző még nincs kész | 'soon' még nincs tartalma
 */
export function lessonStatuses(state, world) {
  let previousDone = true;
  return world.lessons.map((lesson) => {
    const done = isLessonCompleted(state, lesson.id);
    let status = 'locked';
    if (lesson.comingSoon) status = 'soon';
    else if (done) status = 'completed';
    else if (previousDone || !SEQUENTIAL_LESSONS) status = 'available';
    previousDone = done;
    return status;
  });
}

export function lessonStatus(state, world, lessonId) {
  const index = world.lessons.findIndex((l) => l.id === lessonId);
  return index < 0 ? null : lessonStatuses(state, world)[index];
}

export function worldProgress(state, world) {
  return {
    completed: world.lessons.filter((l) => isLessonCompleted(state, l.id)).length,
    total: world.lessons.length,
  };
}

// --- Állapotátmenetek ------------------------------------------------------------------------

function withLesson(state, lessonId, patch) {
  return {
    ...state,
    lessons: { ...state.lessons, [lessonId]: { ...getLessonProgress(state, lessonId), ...patch } },
  };
}

function touchStreak(state, today) {
  const streak = registerActivity(state.streak, today);
  if (streak === state.streak) return { state, events: [] };
  return { state: { ...state, streak }, events: [{ type: 'streak', count: streak.count }] };
}

/** XP jóváírása. Minden jutalom külön 'xp' eseményt kap; szintlépésből egyet adunk (honnan → hová). */
export function gainXp(state, awards) {
  const valid = awards.filter((a) => a.amount > 0);
  if (valid.length === 0) return { state, events: [] };
  const from = levelForXp(state.xp);
  const xp = state.xp + valid.reduce((sum, a) => sum + a.amount, 0);
  const to = levelForXp(xp);
  const events = valid.map((a) => ({ type: 'xp', amount: a.amount, reason: a.reason }));
  if (to > from) events.push({ type: 'levelup', from, to, title: levelTitle(to) });
  return { state: { ...state, xp }, events };
}

function finish(state, today, awards, extraEvents = []) {
  const streak = touchStreak(state, today);
  const xp = gainXp(streak.state, awards);
  return { state: xp.state, events: [...streak.events, ...xp.events, ...extraEvents] };
}

/** A videós lépés teljesítése. Csak akkor számít (XP, sorozat), ha a videót tényleg elindították. */
export function completeVideo(state, lessonId, today) {
  const before = getLessonProgress(state, lessonId);
  const next = withLesson(state, lessonId, { videoDone: true });
  return finish(next, today, before.videoDone ? [] : [{ amount: XP_REWARDS.video, reason: 'video' }]);
}

export function completeSlides(state, lessonId, today) {
  const before = getLessonProgress(state, lessonId);
  const next = withLesson(state, lessonId, { slidesDone: true });
  return finish(next, today, before.slidesDone ? [] : [{ amount: XP_REWARDS.slides, reason: 'slides' }]);
}

/** Kvíz vége. Visszaadja az eredmény összegzését is (`result`). */
export function finishQuiz(state, lessonId, { correct, total }, today) {
  const before = getLessonProgress(state, lessonId);
  const passed = isPassing(correct, total);
  const perfect = total > 0 && correct === total;
  const wasPerfect = before.quizTotal > 0 && before.quizBest >= before.quizTotal;
  const firstCompletion = passed && !before.completedAt;
  const improvement = Math.max(0, correct - Math.min(before.quizBest, total));

  const next = withLesson(state, lessonId, {
    quizBest: Math.min(total, Math.max(before.quizBest, correct)),
    quizTotal: total,
    quizAttempts: before.quizAttempts + 1,
    completedAt: before.completedAt ?? (passed ? today : null),
  });
  const awards = [
    { amount: improvement * XP_REWARDS.correctAnswer, reason: 'quiz' },
    { amount: perfect && !wasPerfect ? XP_REWARDS.perfectQuiz : 0, reason: 'perfect' },
    { amount: firstCompletion ? XP_REWARDS.lessonComplete : 0, reason: 'lesson' },
  ];
  const outcome = finish(next, today, awards, firstCompletion ? [{ type: 'lesson-complete', lessonId }] : []);
  const xpGained = outcome.events.filter((e) => e.type === 'xp').reduce((sum, e) => sum + e.amount, 0);
  return { ...outcome, result: { correct, total, passed, perfect, firstCompletion, xpGained } };
}
