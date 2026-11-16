// Data e hora dos eventos no padrão brasileiro (estilos.md §3), no fuso de quem usa.

const formatoDiaHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14/11/2026 às 09:05"; vazio se a data for inválida (a tabela mostra "—"). */
export function diaHora(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return '';
  const partes = formatoDiaHora.formatToParts(quando);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('day')}/${valor('month')}/${valor('year')} às ${valor('hour')}:${valor('minute')}`;
}
