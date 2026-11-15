import type { ReactNode } from 'react';
import { Inicio } from '../inicio';
import { IconeInicio } from './icones';

/** As telas que o `<FluxoCalculo>` sabe abrir pela propriedade `tela`. Cada épico acrescenta as suas. */
export type TelaFluxo = 'inicio';

/** Uma tela do módulo: rota interna, item do menu lateral (casca) e aba (incorporado). */
export interface DefinicaoTela {
  id: string;
  /** Nome da tela no menu e na aba: substantivo, sem ponto final (estilos.md §10). */
  rotulo: string;
  /** Caminho da rota interna, sem a barra inicial. */
  caminho: string;
  /** Ícone Lucide de 16px do item do menu lateral. */
  icone: ReactNode;
  /** Permissão exigida (ex.: `auditoria.ver`). Sem ela, a tela não aparece no menu nem nas abas, e a rota não abre. */
  permissao?: string;
  conteudo: ReactNode;
}

/** As telas do módulo, na ordem do menu (design.md §15). O épico 1 só tem o Início, aberto a todos. */
export const TELAS: readonly DefinicaoTela[] = [
  { id: 'inicio', rotulo: 'Início', caminho: 'inicio', icone: <IconeInicio />, conteudo: <Inicio /> },
];

/** As telas que o usuário pode ver no tenant atual. Itens sem permissão não aparecem (design.md §15). */
export function telasPermitidas(
  telas: readonly DefinicaoTela[],
  temPermissao: (codigo: string) => boolean,
): readonly DefinicaoTela[] {
  return telas.filter((tela) => tela.permissao === undefined || temPermissao(tela.permissao));
}
