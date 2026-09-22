export function pick(list) {
  if (!Array.isArray(list)) return list;
  return list[Math.floor(Math.random() * list.length)];
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Egyszerű sablon: format('{n} napos sorozat', { n: 3 }) → '3 napos sorozat' */
export function format(template, vars = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
