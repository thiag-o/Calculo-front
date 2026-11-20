const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * When something happened, as the interface writes it (estilos.md §3 and §10), in the browser time zone:
 * - less than a minute ago (or a clock slightly ahead): "há instantes";
 * - less than an hour ago: "há 12 min";
 * - earlier today: "há 2 h";
 * - yesterday: "ontem 03:00";
 * - before that: "em 02/10" (with the year when it is not this year: "em 02/10/2025").
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const moment = new Date(iso);
  const elapsed = now.getTime() - moment.getTime();
  if (elapsed < MINUTE) return 'há instantes';
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (sameDay(moment, now)) return `há ${Math.floor(elapsed / HOUR)} h`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(moment, yesterday)) return `ontem ${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
  const day = `${twoDigits(moment.getDate())}/${twoDigits(moment.getMonth() + 1)}`;
  return moment.getFullYear() === now.getFullYear() ? `em ${day}` : `em ${day}/${moment.getFullYear()}`;
}
