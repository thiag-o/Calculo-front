// Datas das listas de integração no padrão brasileiro (estilos.md §3), no fuso de quem usa.

const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatoDiaHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function data(iso: string): Date | undefined {
  const quando = new Date(iso);
  return Number.isNaN(quando.getTime()) ? undefined : quando;
}

/** "14/11/2026"; vazio se a data for inválida (a tabela mostra "—"). */
export function dia(iso: string): string {
  const quando = data(iso);
  return quando ? formatoDia.format(quando) : '';
}

/** "14/11/2026 às 09:05"; vazio se a data for inválida. */
export function diaHora(iso: string): string {
  const quando = data(iso);
  if (!quando) return '';
  const partes = formatoDiaHora.formatToParts(quando);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('day')}/${valor('month')}/${valor('year')} às ${valor('hour')}:${valor('minute')}`;
}
