/** Devuelve la fecha de hoy como 'YYYY-MM-DD', en hora local del navegador. */
export function todayAsIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Agrupa una lista de partidos por su campo `date`, preservando el orden. */
export function groupMatchesByDate(matches) {
  const groups = new Map();
  for (const match of matches) {
    if (!groups.has(match.date)) groups.set(match.date, []);
    groups.get(match.date).push(match);
  }
  return groups;
}

/**
 * Encuentra la fase y fecha "más relevante" para abrir por defecto al cargar
 * la web: la fecha de hoy si hay partidos hoy, o si no, la fecha futura más
 * cercana; si ya pasaron todas, la fecha más reciente jugada.
 */
export function findMostRelevantMatch(matches) {
  if (matches.length === 0) return null;

  const today = todayAsIsoDate();
  const todayMatches = matches.filter((m) => m.date === today);
  if (todayMatches.length > 0) return todayMatches[0];

  const future = matches
    .filter((m) => m.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (future.length > 0) return future[0];

  const past = matches.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return past[0] || matches[0];
}

export function formatReadableDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Versión corta para usarla como etiqueta de un tab (ej. "1 jul."). */
export function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

/**
 * De una lista de fechas ('YYYY-MM-DD') ya ordenada o no, elige la más
 * relevante para dejarla preseleccionada: hoy si hay partidos hoy, si no la
 * próxima fecha futura, y si ya pasaron todas, la más reciente jugada.
 */
export function findMostRelevantDate(dates) {
  if (dates.length === 0) return null;

  const today = todayAsIsoDate();
  if (dates.includes(today)) return today;

  const future = dates.filter((d) => d > today).sort();
  if (future.length > 0) return future[0];

  const past = dates.filter((d) => d < today).sort().reverse();
  return past[0] || dates[0];
}
