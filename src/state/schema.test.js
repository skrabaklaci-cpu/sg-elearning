import { describe, expect, it } from 'vitest';
import { createInitialState, normalizeState, SCHEMA_VERSION } from './schema.js';

describe('normalizeState', () => {
  it.each([null, undefined, 'szöveg', 42, [], true])('érvénytelen bemenetből (%p) alapállapot lesz', (raw) => {
    expect(normalizeState(raw)).toEqual(createInitialState());
  });

  it('megtartja az érvényes adatot', () => {
    const saved = {
      version: SCHEMA_VERSION,
      xp: 130,
      streak: { count: 2, best: 5, lastActiveDate: '2026-09-21' },
      lessons: { 'math-01': { videoDone: true, slidesDone: true, quizBest: 3, quizTotal: 4, quizAttempts: 1, completedAt: '2026-09-21' } },
      flags: { introSeen: true },
      createdAt: '2026-09-20',
    };
    expect(normalizeState(saved)).toEqual(saved);
  });

  it('kijavítja a sérült mezőket és eldobja az ismeretleneket', () => {
    const state = normalizeState({
      xp: -5,
      streak: { count: 'sok', lastActiveDate: 'tegnap' },
      lessons: { 'rossz id!': {}, ok: { quizBest: 2.7, completedAt: 12 } },
      flags: { introSeen: 'igen' },
      hacker: true,
    });
    expect(state.xp).toBe(0);
    expect(state.streak).toEqual({ count: 0, best: 0, lastActiveDate: null });
    expect(Object.keys(state.lessons)).toEqual(['ok']);
    expect(state.lessons.ok.quizBest).toBe(2);
    expect(state.lessons.ok.completedAt).toBeNull();
    expect(state.flags.introSeen).toBe(false);
    expect(state).not.toHaveProperty('hacker');
  });

  it('az újraszabott tárgyak haladását eldobja, az XP-t megtartja', () => {
    const saved = {
      xp: 120,
      lessons: {
        'math-01': { completedAt: '2026-09-22', quizBest: 3, quizTotal: 4 },
        'history-01': { completedAt: '2026-09-22', quizBest: 4, quizTotal: 4 },
        'physics-01': { completedAt: '2026-09-22', quizBest: 4, quizTotal: 4 },
      },
    };

    // v1-es mentés: a matek és a történelem is újraszabva
    const fromV1 = normalizeState({ ...saved, version: 1 });
    expect(fromV1.version).toBe(SCHEMA_VERSION);
    expect(fromV1.xp).toBe(120);
    expect(Object.keys(fromV1.lessons)).toEqual(['physics-01']);

    // v2-es mentés: már csak a történelem
    const fromV2 = normalizeState({ ...saved, version: 2 });
    expect(Object.keys(fromV2.lessons).sort()).toEqual(['math-01', 'physics-01']);
  });

  it('JSON-oda-vissza alakítás után ugyanaz marad', () => {
    const state = normalizeState({ xp: 10, flags: { introSeen: true } });
    expect(normalizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
