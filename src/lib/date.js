// Naptári dátumok a streakhez. Mindig a készülék helyi ideje szerinti napot használjuk,
// 'YYYY-MM-DD' stringként (JSON-ban tárolható, időzóna-független összehasonlítás).

export function toLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Hány nap telt el `from` és `to` között (egész szám, negatív is lehet). A nyári időszámítás nem zavarja. */
export function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
