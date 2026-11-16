import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Administracao, PERMISSOES_ADMINISTRACAO, type AbaAdministracao } from '../administracao';
import { Auditoria } from '../auditoria';
import { Inicio } from '../inicio';
import { IconeAuditoria, IconeInicio, IconeIntegracao, IconePapeis, IconeSeguranca, IconeUsuarios } from './icones';

/** Seções do menu lateral (estilos.md §9). As telas sem seção ficam no topo do menu. */
export type SecaoMenu = 'administracao';

/**
 * Cada seção:
 * - `rotulo`: no casca, acima dos itens dela (`label-12` terciário); no modo incorporado, o nome da aba dela;
 * - `caminho`: rota que abre a primeira tela permitida da seção (a aba do modo incorporado aponta para ela).
 */
export const SECOES: Record<SecaoMenu, { rotulo: string; caminho: string }> = {
  administracao: { rotulo: 'Administração', caminho: 'administracao' },
};

/**
 * As telas que o `<FluxoCalculo>` sabe abrir pela propriedade `tela`. Cada épico acrescenta as suas.
 * - `inicio`: Início, aberto a todos;
 * - `auditoria`: Auditoria (`auditoria.ver`);
 * - `administracao`: a Administração, na primeira área permitida;
 * - `usuarios`, `papeis`, `integracao` e `seguranca`: a Administração já numa área, cada uma com a sua permissão.
 * Sem a permissão, o módulo abre na primeira tela permitida.
 */
export type TelaFluxo = 'inicio' | 'auditoria' | SecaoMenu | AbaAdministracao;

/** Uma tela do módulo: rota interna e item do menu lateral (casca) ou aba (incorporado). */
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
  /**
   * Seção em que a tela fica. No casca, a seção agrupa os itens no menu lateral (ex.: Administração, no rodapé). No
   * modo incorporado, a seção inteira é uma aba só, e a própria tela navega entre as telas dela.
   */
  secao?: SecaoMenu;
  conteudo: ReactNode;
}

/** Caminho da rota de uma área da Administração. */
const caminhoAdministracao = (aba: AbaAdministracao) => `${SECOES.administracao.caminho}/${aba}`;

/**
 * A `<Administracao>` dentro do módulo, igual no casca e no modo incorporado: cada aba interna é uma rota, para o
 * menu lateral, o endereço e a propriedade `tela` abrirem a área certa.
 */
function AdministracaoNaRota({ aba }: { aba: AbaAdministracao }) {
  const navegar = useNavigate();
  return <Administracao aba={aba} aoTrocarAba={(outra) => void navegar(`/${caminhoAdministracao(outra)}`)} />;
}

/** Uma área da Administração: item da seção no menu lateral e rota com a sua permissão. */
function areaAdministracao(id: AbaAdministracao, rotulo: string, icone: ReactNode): DefinicaoTela & { id: TelaFluxo } {
  return {
    id,
    rotulo,
    caminho: caminhoAdministracao(id),
    icone,
    permissao: PERMISSOES_ADMINISTRACAO[id],
    secao: 'administracao',
    conteudo: <AdministracaoNaRota aba={id} />,
  };
}

/**
 * As telas do módulo, na ordem do menu (design.md §15): Início e Auditoria; depois a seção Administração, com
 * Usuários, Papéis, Integração e Segurança, cada uma com a permissão da sua área. No modo incorporado, as abas são
 * Início, Auditoria e Administração.
 */
export const TELAS: readonly (DefinicaoTela & { id: TelaFluxo })[] = [
  { id: 'inicio', rotulo: 'Início', caminho: 'inicio', icone: <IconeInicio />, conteudo: <Inicio /> },
  {
    id: 'auditoria',
    rotulo: 'Auditoria',
    caminho: 'auditoria',
    icone: <IconeAuditoria />,
    permissao: 'auditoria.ver',
    conteudo: <Auditoria />,
  },
  areaAdministracao('usuarios', 'Usuários', <IconeUsuarios />),
  areaAdministracao('papeis', 'Papéis', <IconePapeis />),
  areaAdministracao('integracao', 'Integração', <IconeIntegracao />),
  areaAdministracao('seguranca', 'Segurança', <IconeSeguranca />),
];

/** As telas que o usuário pode ver no tenant atual. Itens sem permissão não aparecem (design.md §15). */
export function telasPermitidas(
  telas: readonly DefinicaoTela[],
  temPermissao: (codigo: string) => boolean,
): readonly DefinicaoTela[] {
  return telas.filter((tela) => tela.permissao === undefined || temPermissao(tela.permissao));
}

export interface GrupoMenu {
  secao: SecaoMenu;
  rotulo: string;
  /** Rota da seção, que abre a primeira tela dela. */
  caminho: string;
  telas: readonly DefinicaoTela[];
}

/**
 * Separa as telas do menu lateral: as sem seção, na ordem em que vêm, e as seções que têm alguma tela, na ordem da
 * primeira tela de cada uma. Uma seção sem telas permitidas some inteira, com o rótulo.
 */
export function agruparPorSecao(telas: readonly DefinicaoTela[]): {
  soltas: readonly DefinicaoTela[];
  secoes: readonly GrupoMenu[];
} {
  const soltas: DefinicaoTela[] = [];
  const secoes = new Map<SecaoMenu, DefinicaoTela[]>();
  for (const tela of telas) {
    if (tela.secao === undefined) {
      soltas.push(tela);
      continue;
    }
    const grupo = secoes.get(tela.secao);
    if (grupo) grupo.push(tela);
    else secoes.set(tela.secao, [tela]);
  }
  return {
    soltas,
    secoes: Array.from(secoes, ([secao, itens]) => ({ secao, ...SECOES[secao], telas: itens })),
  };
}

/**
 * A tela em que o módulo abre: a do `id` pedido; se o `id` é de uma seção, a primeira tela dela; senão (ou sem
 * permissão), a primeira tela permitida.
 */
export function telaInicial(telas: readonly DefinicaoTela[], id: string | undefined): DefinicaoTela | undefined {
  if (id === undefined) return telas[0];
  return telas.find((tela) => tela.id === id) ?? telas.find((tela) => tela.secao === id) ?? telas[0];
}
