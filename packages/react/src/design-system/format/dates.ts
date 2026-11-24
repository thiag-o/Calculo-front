// Dates on screen (estilos.md §3): dd/mm/aaaa, with the time as hh:mm:ss. Only text is handled.

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-11-20` → `20/11/2026`, without going through a date (no time zone shift). */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** ISO 8601 → `20/11/2026 10:30:00`, in the browser's time zone (the one the date was typed in). */
export function formatDateTime(value: string): string {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return value;
  const date = `${two(moment.getDate())}/${two(moment.getMonth() + 1)}/${moment.getFullYear()}`;
  return `${date} ${two(moment.getHours())}:${two(moment.getMinutes())}:${two(moment.getSeconds())}`;
}
