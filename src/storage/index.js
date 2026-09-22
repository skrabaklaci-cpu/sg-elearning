// Az app EGYETLEN tárhely-kapuja. Csak a src/state/store.js hívja.
//
// Az interfész szándékosan aszinkron: a későbbi wixAdapter postMessage-dzsel küldi az adatot
// a Wix Velo kódnak, és válaszra vár. A hívóknak ezért nem kell majd változniuk.
//
// A három függvény soha nem dob kivételt: hiba esetén a load() `null`-t ad, a save()/reset()
// csak figyelmeztetést ír a konzolra.

import { createLocalStorageAdapter } from './localStorageAdapter.js';
import { createMemoryAdapter } from './memoryAdapter.js';

/**
 * @typedef {object} StorageAdapter
 * @property {string} name
 * @property {() => Promise<object | null>} load
 * @property {(state: object) => Promise<void>} save
 * @property {() => Promise<void>} reset
 */

/** A környezetben használható legjobb adapter. Később ide kerül a wixAdapter kiválasztása is. */
export function selectAdapter() {
  return createLocalStorageAdapter() ?? createMemoryAdapter();
}

let adapter = null;

function current() {
  adapter ??= selectAdapter();
  return adapter;
}

/** @returns {Promise<object | null>} a mentett állapot, vagy `null` */
export async function load() {
  try {
    return (await current().load()) ?? null;
  } catch (err) {
    console.warn('[storage] betöltési hiba', err);
    return null;
  }
}

/** @param {object} state JSON-szerializálható állapot */
export async function save(state) {
  try {
    await current().save(state);
  } catch (err) {
    console.warn('[storage] mentési hiba', err);
  }
}

export async function reset() {
  try {
    await current().reset();
  } catch (err) {
    console.warn('[storage] törlési hiba', err);
  }
}

/** Hibakereséshez: melyik adapter fut. */
export function adapterName() {
  return current().name;
}
