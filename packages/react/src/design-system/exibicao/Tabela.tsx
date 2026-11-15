import type { ReactNode } from 'react';
import { Esqueleto } from './Carregando';
import './carregando.css';
import './tabela.css';

export interface ColunaTabela<T> {
  /** Identificador estável da coluna. */
  chave: string;
  /** Título no cabeçalho (label-12 terciário). */
  titulo: string;
  /** Conteúdo da célula para uma linha. Vazio vira "—" (estilos.md §1.2). */
  celula: (linha: T) => ReactNode;
  /** `fim` para números e ações. Padrão: `inicio`. */
  alinhamento?: 'inicio' | 'fim';
  /** Largura CSS da coluna ("120px", "20%"). Padrão: automática. */
  largura?: string;
  /** Esconde o título só visualmente (coluna de ações "…"); o leitor de tela continua lendo. */
  tituloOculto?: boolean;
  /** Largura da barra desta coluna no esqueleto (px ou CSS). Padrão: 60%. */
  larguraEsqueleto?: number | string;
}

export interface TabelaProps<T> {
  /** Nome da tabela para o leitor de tela (`<caption>`, oculto na tela): "Execuções recentes". */
  legenda: string;
  colunas: readonly ColunaTabela<T>[];
  /** As linhas. `undefined` enquanto não chegaram. */
  linhas: readonly T[] | undefined;
  /** Chave estável de cada linha (o id). */
  chaveLinha: (linha: T) => string;
  /** Mostra o esqueleto no lugar das linhas (estilos.md §14). Vence `erro` e `vazio`. */
  carregando?: boolean;
  /** Linhas do esqueleto. Padrão: 3. */
  linhasCarregando?: number;
  /** Erro no lugar das linhas, em geral um `Aviso tipo="erro"` com a ação para resolver. Vence `vazio`. */
  erro?: ReactNode;
  /** Estado vazio, em geral um `EstadoVazio`. Obrigatório: toda lista tem o estado vazio desenhado (estilos.md §14). */
  vazio: ReactNode;
  className?: string;
}

function classesAlinhamento(alinhamento: ColunaTabela<unknown>['alinhamento']) {
  return alinhamento === 'fim' ? 'fc-tabela-fim' : null;
}

function juntar(...classes: (string | null | undefined | false)[]) {
  return classes.filter(Boolean).join(' ') || undefined;
}

function semConteudo(valor: ReactNode) {
  return valor === null || valor === undefined || valor === false || valor === '';
}

/**
 * Tabela simples (estilos.md §7.6 e §9) dentro de uma caixa: cabeçalho de 32px em label-12 terciário, linhas com
 * divisória de 1px e hover. Tem os estados de carregando (esqueleto, `aria-busy`), erro e vazio.
 */
export function Tabela<T>({
  legenda,
  colunas,
  linhas,
  chaveLinha,
  carregando = false,
  linhasCarregando = 3,
  erro,
  vazio,
  className,
}: TabelaProps<T>) {
  const temErro = !carregando && !semConteudo(erro);
  const estaVazia = !carregando && !temErro && (linhas?.length ?? 0) === 0;
  const totalColunas = Math.max(colunas.length, 1);

  let corpo: ReactNode;
  if (carregando) {
    corpo = Array.from({ length: linhasCarregando }, (_, indice) => (
      <tr key={indice} className="fc-tabela-linha fc-tabela-linha-esqueleto" aria-hidden="true">
        {colunas.map((coluna) => (
          <td key={coluna.chave} className={juntar('fc-tabela-celula', classesAlinhamento(coluna.alinhamento))}>
            <Esqueleto largura={coluna.larguraEsqueleto ?? '60%'} />
          </td>
        ))}
      </tr>
    ));
  } else if (temErro || estaVazia) {
    corpo = (
      <tr className="fc-tabela-linha-unica">
        <td className="fc-tabela-celula fc-tabela-celula-unica" colSpan={totalColunas}>
          {temErro ? erro : vazio}
        </td>
      </tr>
    );
  } else {
    corpo = (linhas ?? []).map((linha) => (
      <tr key={chaveLinha(linha)} className="fc-tabela-linha">
        {colunas.map((coluna) => {
          const conteudo = coluna.celula(linha);
          return (
            <td key={coluna.chave} className={juntar('fc-tabela-celula', classesAlinhamento(coluna.alinhamento))}>
              {semConteudo(conteudo) ? <span className="fc-tabela-sem-valor">—</span> : conteudo}
            </td>
          );
        })}
      </tr>
    ));
  }

  return (
    <div className={juntar('fc-tabela', className)}>
      {/* Sempre presente, para a mudança de "Carregando" ser anunciada. */}
      <span role="status" className="fc-oculto-visualmente">
        {carregando ? `Carregando ${legenda.toLocaleLowerCase('pt-BR')}` : ''}
      </span>
      <table className="fc-tabela-tabela" aria-busy={carregando || undefined}>
        <caption className="fc-oculto-visualmente">{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                className={juntar('fc-tabela-cabecalho', classesAlinhamento(coluna.alinhamento))}
                style={coluna.largura ? { width: coluna.largura } : undefined}
              >
                {coluna.tituloOculto ? <span className="fc-oculto-visualmente">{coluna.titulo}</span> : coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{corpo}</tbody>
      </table>
    </div>
  );
}
