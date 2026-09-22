// Tartalék adapter: csak a lap élettartamáig őrzi az állapotot.
// Akkor használjuk, ha a localStorage nem elérhető (pl. tiltott harmadik féltől származó tárhely iframe-ben).
// JSON-oda-vissza alakítással dolgozik, hogy ugyanúgy viselkedjen, mint a valódi adapterek.

/** @returns {import('./index.js').StorageAdapter} */
export function createMemoryAdapter() {
  let saved = null;
  return {
    name: 'memory',
    async load() {
      return saved === null ? null : JSON.parse(saved);
    },
    async save(state) {
      saved = JSON.stringify(state);
    },
    async reset() {
      saved = null;
    },
  };
}
