import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ErroApi } from '../api';
import { Aviso, Botao, Caixa, Carregando, EstadoVazio } from '../design-system';
import { useSessao } from '../sessao';
import { Integracao } from './integracao';
import { Papeis } from './papeis';
import { Seguranca } from './seguranca';
import { Usuarios } from './usuarios';
import './administracao.css';

/** As áreas da Administração, na ordem das abas e do menu. */
export type AbaAdministracao = 'usuarios' | 'papeis' | 'integracao' | 'seguranca';

/**
 * A permissão que abre cada área (contrato: o escopo das rotas de cada uma). O módulo usa as mesmas no menu lateral
 * e nas abas do modo incorporado, para a tela avulsa e o módulo mostrarem as mesmas áreas a cada pessoa.
 */
export const PERMISSOES_ADMINISTRACAO = {
  usuarios: 'usuarios.gerenciar',
  papeis: 'papeis.gerenciar',
  integracao: 'integracao.gerenciar',
  seguranca: 'seguranca.gerenciar',
} as const satisfies Record<AbaAdministracao, string>;

interface DefinicaoAba {
  id: AbaAdministracao;
  /** Nome da aba: substantivo, sem ponto final (estilos.md §10). */
  rotulo: string;
  conteudo: () => ReactNode;
}

const ABAS: readonly DefinicaoAba[] = [
  { id: 'usuarios', rotulo: 'Usuários', conteudo: () => <Usuarios /> },
  { id: 'papeis', rotulo: 'Papéis', conteudo: () => <Papeis /> },
  { id: 'integracao', rotulo: 'Integração', conteudo: () => <Integracao /> },
  { id: 'seguranca', rotulo: 'Segurança', conteudo: () => <Seguranca /> },
];

export interface AdministracaoProps {
  /**
   * Aba aberta, quando quem usa a tela controla a escolha (o `<FluxoCalculo>` liga cada aba a uma rota). Sem ela, a
   * tela guarda a escolha sozinha e começa na primeira aba permitida.
   */
  aba?: AbaAdministracao;
  /** Chamado quando a pessoa escolhe outra aba (clique ou teclado). */
  aoTrocarAba?: (aba: AbaAdministracao) => void;
}

/**
 * A Administração inteira: abas internas Usuários, Papéis, Integração e Segurança, cada uma só para quem tem a
 * permissão dela (`PERMISSOES_ADMINISTRACAO`). É a mesma tela no menu do casca, na aba do modo incorporado e avulsa.
 * Avulsa, as abas não mexem na URL. Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo` (portais
 * dos diálogos e menus).
 */
export function Administracao({ aba, aoTrocarAba }: AdministracaoProps = {}) {
  const sessao = useSessao();
  const [escolhidaLocal, setEscolhidaLocal] = useState<AbaAdministracao | null>(null);
  const escolhida = aba ?? escolhidaLocal;
  const idBase = useId();
  const botoes = useRef(new Map<AbaAdministracao, HTMLButtonElement>());

  // Com uma sessão no cache, um erro numa nova busca não tira a tela; sem ela, mostra o estado da busca.
  if (!sessao.data) {
    if (sessao.isError) {
      const detalhe = sessao.error instanceof ErroApi ? sessao.error.mensagem : 'Tente de novo em instantes.';
      return (
        <div className="fc-administracao">
          <Aviso
            tipo="erro"
            titulo="Não foi possível abrir a Administração"
            acoes={
              <Botao tamanho="pequeno" carregando={sessao.isFetching} onClick={() => void sessao.refetch()}>
                Tentar de novo
              </Botao>
            }
          >
            {detalhe}
          </Aviso>
        </div>
      );
    }
    return (
      <div className="fc-administracao">
        <Carregando rotulo="Carregando a Administração" linhas={4} />
      </div>
    );
  }

  const visiveis = ABAS.filter((item) => sessao.temPermissao(PERMISSOES_ADMINISTRACAO[item.id]));
  // A aba escolhida pode deixar de valer (outro tenant, papéis mudados): fica a primeira permitida.
  const atual = visiveis.find((item) => item.id === escolhida) ?? visiveis[0];

  if (!atual) {
    return (
      <div className="fc-administracao">
        <Caixa como="div">
          <EstadoVazio
            titulo="Nenhuma área da Administração disponível para você"
            descricao="Peça ao administrador do cliente as permissões de que precisa."
          />
        </Caixa>
      </div>
    );
  }

  const idAba = (id: AbaAdministracao) => `${idBase}-aba-${id}`;
  const idPainel = `${idBase}-painel`;

  // Escolher a aba que já está aberta não avisa ninguém (no módulo, não empilha a mesma rota no histórico).
  function escolher(id: AbaAdministracao) {
    if (id === atual?.id) return;
    setEscolhidaLocal(id);
    aoTrocarAba?.(id);
  }

  function ativar(destino: DefinicaoAba) {
    escolher(destino.id);
    botoes.current.get(destino.id)?.focus();
  }

  // Teclado das abas (WAI-ARIA, ativação automática): setas andam e escolhem, Home e End vão às pontas.
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const indice = visiveis.findIndex((item) => item.id === atual?.id);
    const destinos: Record<string, number> = {
      ArrowRight: (indice + 1) % visiveis.length,
      ArrowLeft: (indice - 1 + visiveis.length) % visiveis.length,
      Home: 0,
      End: visiveis.length - 1,
    };
    const destino = destinos[evento.key];
    const alvo = destino === undefined ? undefined : visiveis[destino];
    if (!alvo) return;
    evento.preventDefault();
    ativar(alvo);
  }

  return (
    <div className="fc-administracao">
      <div className="fc-administracao-abas">
        <div className="fc-administracao-abas-lista" role="tablist" aria-label="Administração" onKeyDown={aoTeclar}>
          {visiveis.map((item) => {
            const selecionada = item.id === atual.id;
            return (
              <button
                key={item.id}
                ref={(elemento) => {
                  if (elemento) botoes.current.set(item.id, elemento);
                  else botoes.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={idAba(item.id)}
                className="fc-administracao-aba"
                aria-selected={selecionada}
                aria-controls={idPainel}
                tabIndex={selecionada ? 0 : -1}
                onClick={() => escolher(item.id)}
              >
                {item.rotulo}
              </button>
            );
          })}
        </div>
      </div>
      {/* O painel começa por um título, que não recebe foco: o próprio painel entra na ordem do Tab. */}
      <div
        key={atual.id}
        id={idPainel}
        role="tabpanel"
        aria-labelledby={idAba(atual.id)}
        tabIndex={0}
        className="fc-administracao-painel"
      >
        {atual.conteudo()}
      </div>
    </div>
  );
}
