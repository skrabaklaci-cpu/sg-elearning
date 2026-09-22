import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageAdapter, STORAGE_KEY } from './localStorageAdapter.js';
import { createMemoryAdapter } from './memoryAdapter.js';
import { selectAdapter } from './index.js';

function fakeLocalStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

function stubLocalStorage(getter) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getter });
}

afterEach(() => {
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe('localStorage adapter', () => {
  it('ment, betölt és töröl', async () => {
    const fake = fakeLocalStorage();
    stubLocalStorage(() => fake);
    const adapter = createLocalStorageAdapter();
    expect(await adapter.load()).toBeNull();
    await adapter.save({ xp: 10 });
    expect(JSON.parse(fake.data.get(STORAGE_KEY))).toEqual({ xp: 10 });
    expect(await adapter.load()).toEqual({ xp: 10 });
    await adapter.reset();
    expect(await adapter.load()).toBeNull();
  });

  it('sérült mentésnél null-t ad, nem dob', async () => {
    const fake = fakeLocalStorage();
    fake.data.set(STORAGE_KEY, '{nem json');
    stubLocalStorage(() => fake);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await createLocalStorageAdapter().load()).toBeNull();
  });

  it('teli tárhelynél a mentés nem dob', async () => {
    const fake = fakeLocalStorage();
    stubLocalStorage(() => fake);
    const adapter = createLocalStorageAdapter();
    fake.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(adapter.save({ xp: 1 })).resolves.toBeUndefined();
  });

  it('ha már a localStorage elérése is dob (tiltott iframe), nincs adapter', () => {
    stubLocalStorage(() => {
      throw new Error('SecurityError');
    });
    expect(createLocalStorageAdapter()).toBeNull();
  });
});

describe('adapterválasztás', () => {
  it('tiltott localStorage esetén memóriás tartalékra vált', async () => {
    stubLocalStorage(() => {
      throw new Error('SecurityError');
    });
    const adapter = selectAdapter();
    expect(adapter.name).toBe('memory');
    await adapter.save({ xp: 5 });
    expect(await adapter.load()).toEqual({ xp: 5 });
  });

  it('elérhető localStorage esetén azt használja', () => {
    stubLocalStorage(() => fakeLocalStorage());
    expect(selectAdapter().name).toBe('localStorage');
  });
});

describe('memória adapter', () => {
  it('másolatot ad vissza, nem referenciát', async () => {
    const adapter = createMemoryAdapter();
    const state = { lessons: { a: { quizBest: 1 } } };
    await adapter.save(state);
    state.lessons.a.quizBest = 99;
    expect((await adapter.load()).lessons.a.quizBest).toBe(1);
  });
});
