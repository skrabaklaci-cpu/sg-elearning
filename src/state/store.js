// Központi állapot. Az egyetlen modul, amely a storage-ot hívja.
//
//  - store.getState()           az aktuális (csak olvasható) állapot
//  - store.subscribe(fn)        minden állapotváltozáskor lefut
//  - store.on('levelup', fn)    játékesemények: 'xp' | 'levelup' | 'streak' | 'lesson-complete'
//  - store.completeVideo(id)…   akciók: az állapotot csak ezeken át módosítjuk
//
// A mentés késleltetve (debounce) történik, a lap elhagyásakor pedig azonnal (flush).

import * as defaultStorage from '../storage/index.js';
import { toLocalDateString } from '../lib/date.js';
import { createInitialState, normalizeState } from './schema.js';
import * as progress from './progress.js';

export function createStore({ storage = defaultStorage, now = () => new Date(), saveDelay = 400 } = {}) {
  let state = createInitialState();
  const listeners = new Set();
  const handlers = new Map();
  let saveTimer = null;
  let dirty = false;

  const today = () => toLocalDateString(now());

  function emit(event) {
    for (const fn of handlers.get(event.type) ?? []) {
      try {
        fn(event);
      } catch (err) {
        console.error('[store] eseménykezelő hiba', err);
      }
    }
  }

  function commit(next, events = []) {
    state = next;
    dirty = true;
    for (const fn of listeners) fn(state);
    events.forEach(emit);
    scheduleSave();
    return events;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, saveDelay);
  }

  async function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    await storage.save(state);
  }

  return {
    getState: () => state,

    /** Betöltés az adapterből. Üres vagy sérült mentésnél alapállapotból indul. */
    async init() {
      state = normalizeState(await storage.load());
      if (!state.createdAt) state = { ...state, createdAt: today() };
      for (const fn of listeners) fn(state);
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type).delete(fn);
    },

    flush,

    today,

    // --- akciók ---

    markIntroSeen() {
      if (state.flags.introSeen) return [];
      return commit({ ...state, flags: { ...state.flags, introSeen: true } });
    },

    completeVideo(lessonId) {
      const out = progress.completeVideo(state, lessonId, today());
      return commit(out.state, out.events);
    },

    completeSlides(lessonId) {
      const out = progress.completeSlides(state, lessonId, today());
      return commit(out.state, out.events);
    },

    /** @returns {{ correct, total, passed, perfect, firstCompletion, xpGained }} */
    finishQuiz(lessonId, score) {
      const out = progress.finishQuiz(state, lessonId, score, today());
      commit(out.state, out.events);
      return out.result;
    },

    /** A teljes haladás törlése (a mentésből is). */
    async resetProgress() {
      clearTimeout(saveTimer);
      dirty = false;
      await storage.reset();
      state = { ...createInitialState(), createdAt: today() };
      for (const fn of listeners) fn(state);
    },
  };
}

export const store = createStore();
