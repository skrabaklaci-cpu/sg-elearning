import { describe, expect, it } from 'vitest';
import { LEVELS, PASS_RATIO, XP_REWARDS } from '../config/progression.js';
import {
  completeSlides,
  completeVideo,
  displayedStreak,
  finishQuiz,
  gainXp,
  lessonStatuses,
  levelForXp,
  levelInfo,
  registerActivity,
} from './progress.js';
import { createInitialState } from './schema.js';

const DAY = '2026-09-22';
const NEXT_DAY = '2026-09-23';

describe('szintek', () => {
  it('a küszöbökön lép szintet', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(LEVELS[1].xp - 1)).toBe(1);
    expect(levelForXp(LEVELS[1].xp)).toBe(2);
    expect(levelForXp(10_000)).toBe(LEVELS.length);
  });

  it('levelInfo a szinten belüli haladást adja', () => {
    const info = levelInfo(LEVELS[1].xp + 10);
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(10);
    expect(info.xpForLevel).toBe(LEVELS[2].xp - LEVELS[1].xp);
    expect(info.isMax).toBe(false);
    expect(levelInfo(10_000).isMax).toBe(true);
  });

  it('gainXp szintlépés eseményt ad, ha átlépjük a küszöböt', () => {
    const state = { ...createInitialState(), xp: LEVELS[1].xp - 5 };
    const { state: next, events } = gainXp(state, [{ amount: 10, reason: 'test' }]);
    expect(next.xp).toBe(LEVELS[1].xp + 5);
    expect(events).toContainEqual({ type: 'levelup', from: 1, to: 2, title: LEVELS[1].title });
  });

  it('gainXp nulla jutalomnál nem változtat', () => {
    const state = createInitialState();
    expect(gainXp(state, [{ amount: 0, reason: 'x' }])).toEqual({ state, events: [] });
  });
});

describe('napi sorozat', () => {
  const empty = { count: 0, best: 0, lastActiveDate: null };

  it('első tevékenység: 1 napos sorozat', () => {
    expect(registerActivity(empty, DAY)).toEqual({ count: 1, best: 1, lastActiveDate: DAY });
  });

  it('ugyanazon a napon nem nő', () => {
    const streak = { count: 3, best: 3, lastActiveDate: DAY };
    expect(registerActivity(streak, DAY)).toBe(streak);
  });

  it('másnap nő, kihagyott nap után újraindul', () => {
    const streak = { count: 3, best: 5, lastActiveDate: DAY };
    expect(registerActivity(streak, NEXT_DAY)).toEqual({ count: 4, best: 5, lastActiveDate: NEXT_DAY });
    expect(registerActivity(streak, '2026-09-25')).toEqual({ count: 1, best: 5, lastActiveDate: '2026-09-25' });
  });

  it('hónap- és évváltáson is működik', () => {
    expect(registerActivity({ count: 2, best: 2, lastActiveDate: '2026-12-31' }, '2027-01-01').count).toBe(3);
  });

  it('visszaállított óra nem nullázza a sorozatot', () => {
    const streak = { count: 4, best: 4, lastActiveDate: NEXT_DAY };
    expect(registerActivity(streak, DAY)).toBe(streak);
  });

  it('a kijelzett sorozat tegnapig él, utána 0', () => {
    const streak = { count: 4, best: 4, lastActiveDate: DAY };
    expect(displayedStreak(streak, DAY)).toBe(4);
    expect(displayedStreak(streak, NEXT_DAY)).toBe(4);
    expect(displayedStreak(streak, '2026-09-24')).toBe(0);
    expect(displayedStreak(empty, DAY)).toBe(0);
  });
});

describe('leckék', () => {
  const world = {
    lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c', comingSoon: true }, { id: 'd' }],
  };

  it('csak az első lecke nyitott az elején', () => {
    expect(lessonStatuses(createInitialState(), world)).toEqual(['available', 'locked', 'soon', 'locked']);
  });

  it('teljesítés után a következő nyílik', () => {
    const state = { ...createInitialState(), lessons: { a: { completedAt: DAY } } };
    expect(lessonStatuses(state, world)).toEqual(['completed', 'available', 'soon', 'locked']);
  });

  it('a videó és a diák XP-je csak egyszer jár', () => {
    let { state, events } = completeVideo(createInitialState(), 'a', DAY);
    expect(state.xp).toBe(XP_REWARDS.video);
    expect(events.map((e) => e.type)).toEqual(['streak', 'xp']);
    ({ state } = completeVideo(state, 'a', DAY));
    expect(state.xp).toBe(XP_REWARDS.video);

    ({ state } = completeSlides(state, 'a', DAY));
    ({ state } = completeSlides(state, 'a', DAY));
    expect(state.xp).toBe(XP_REWARDS.video + XP_REWARDS.slides);
    expect(state.lessons.a.slidesDone).toBe(true);
  });

  it('hibátlan kvíz: helyes válaszok + hibátlan bónusz + teljesítés', () => {
    const { state, result, events } = finishQuiz(createInitialState(), 'a', { correct: 4, total: 4 }, DAY);
    const expected = 4 * XP_REWARDS.correctAnswer + XP_REWARDS.perfectQuiz + XP_REWARDS.lessonComplete;
    expect(result).toMatchObject({ passed: true, perfect: true, firstCompletion: true, xpGained: expected });
    expect(state.xp).toBe(expected);
    expect(state.lessons.a.completedAt).toBe(DAY);
    expect(events).toContainEqual({ type: 'lesson-complete', lessonId: 'a' });
  });

  it('ismételt kvízért csak a javulás jár', () => {
    let { state } = finishQuiz(createInitialState(), 'a', { correct: 2, total: 4 }, DAY);
    const afterFirst = state.xp;
    ({ state } = finishQuiz(state, 'a', { correct: 2, total: 4 }, DAY));
    expect(state.xp).toBe(afterFirst);
    const out = finishQuiz(state, 'a', { correct: 4, total: 4 }, DAY);
    expect(out.result.xpGained).toBe(2 * XP_REWARDS.correctAnswer + XP_REWARDS.perfectQuiz);
    expect(out.state.lessons.a.quizAttempts).toBe(3);
  });

  it('a küszöb alatti kvíz nem teljesíti a leckét', () => {
    const total = 4;
    const correct = Math.ceil(PASS_RATIO * total) - 1;
    const { state, result } = finishQuiz(createInitialState(), 'a', { correct, total }, DAY);
    expect(result.passed).toBe(false);
    expect(state.lessons.a.completedAt).toBeNull();
    expect(lessonStatuses(state, world)[1]).toBe('locked');
  });
});
