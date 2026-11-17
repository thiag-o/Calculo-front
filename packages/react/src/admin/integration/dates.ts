// Dates of the integration lists in the Brazilian format (estilos.md §3), in the user's time zone.

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function data(iso: string): Date | undefined {
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? undefined : when;
}

/** "14/11/2026"; empty if the date is invalid (the table shows "—"). */
export function day(iso: string): string {
  const when = data(iso);
  return when ? dayFormat.format(when) : '';
}

/** "14/11/2026 às 09:05"; empty if the date is invalid. */
export function dateTime(iso: string): string {
  const when = data(iso);
  if (!when) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}
