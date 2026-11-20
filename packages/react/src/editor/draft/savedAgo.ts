const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The editor's "Salvo há…" (estilos.md §3, §10 and §16), in the browser time zone:
 * "Salvo há instantes" (under a minute, or a clock slightly ahead), "Salvo há 12 min", "Salvo há 2 h" (earlier today),
 * "Salvo ontem 03:00" and "Salvo em 02/10" (with the year when it is not this year).
 */
export function savedAgo(iso: string, now: Date = new Date()): string {
  const moment = new Date(iso);
  const elapsed = now.getTime() - moment.getTime();
  if (elapsed < MINUTE) return 'Salvo há instantes';
  if (elapsed < HOUR) return `Salvo há ${Math.floor(elapsed / MINUTE)} min`;
  if (sameDay(moment, now)) return `Salvo há ${Math.floor(elapsed / HOUR)} h`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(moment, yesterday)) return `Salvo ontem ${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
  const day = `${twoDigits(moment.getDate())}/${twoDigits(moment.getMonth() + 1)}`;
  return moment.getFullYear() === now.getFullYear() ? `Salvo em ${day}` : `Salvo em ${day}/${moment.getFullYear()}`;
}
