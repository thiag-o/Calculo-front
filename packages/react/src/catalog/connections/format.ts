// Texts of the connections screen: type names, dates and durations in the Brazilian format (estilos.md §3).
import type { ConnectionType } from './queries';

/** Name of each database engine on screen. */
export const TYPE_LABELS: Record<ConnectionType, string> = {
  postgres: 'PostgreSQL',
  sqlserver: 'SQL Server',
};

/** Default port of each engine: the port field starts with it and follows the type while nobody changed it. */
export const DEFAULT_PORTS: Record<ConnectionType, number> = {
  postgres: 5432,
  sqlserver: 1433,
};

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14/11/2026 às 09:05", in the user's time zone; empty if the date is invalid (the table shows "—"). */
export function dateTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}

const secondsFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** How long a test took: "230 ms", "1,4 s" or "1m 05s" (estilos.md §3). */
export function duration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  if (milliseconds < 60_000) return `${secondsFormat.format(milliseconds / 1000)} s`;
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** "Sim" or "Não". */
export function yesNo(value: boolean): string {
  return value ? 'Sim' : 'Não';
}
