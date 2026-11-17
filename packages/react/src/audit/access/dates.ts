// Event date and time in the Brazilian format (estilos.md §3), in the user's time zone.

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14/11/2026 às 09:05"; empty if the date is invalid (the table shows "—"). */
export function dateTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}
