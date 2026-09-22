// localStorage-alapú mentés.
// Cross-site iframe-ben (Wix) a böngésző tilthatja a tárhelyet: ilyenkor már a
// `globalThis.localStorage` puszta elérése is kivételt dob. Ezért minden hozzáférés try/catch-ben van.

export const STORAGE_KEY = 'sg-elearning:save';

/** A használható localStorage, vagy `null`, ha nem elérhető / tiltott / tele van. */
function getLocalStorage(key) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${key}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** @returns {import('./index.js').StorageAdapter | null} `null`, ha a localStorage nem használható */
export function createLocalStorageAdapter({ key = STORAGE_KEY } = {}) {
  const storage = getLocalStorage(key);
  if (!storage) return null;

  return {
    name: 'localStorage',

    async load() {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.warn('[storage] a mentés nem olvasható, üres állapotból indulunk', err);
        return null;
      }
    },

    async save(state) {
      try {
        storage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn('[storage] a mentés nem sikerült', err);
      }
    },

    async reset() {
      try {
        storage.removeItem(key);
      } catch (err) {
        console.warn('[storage] a mentés nem törölhető', err);
      }
    },
  };
}
