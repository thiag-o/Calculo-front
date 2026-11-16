import type { ReactNode } from 'react';
import { Administracao as TelaAdministracao, PERMISSOES_ADMINISTRACAO } from '../../administracao';
import { Auditoria as TelaAuditoria } from '../../auditoria';
import { Inicio as TelaInicio } from '../../inicio';
import { useSessao } from '../../sessao';
import { CarregandoModulo, ErroModulo, SemAcesso } from '../EstadosModulo';
import type { FluxoCalculoProps } from '../FluxoCalculo';
import { ProvedorModulo } from '../ProvedorModulo';
import { Roteador } from '../roteador/Roteador';

/**
 * Props de uma tela avulsa: as mesmas do `<FluxoCalculo>`, menos `tela` e `navegacao`. A navegação de uma tela
 * avulsa é sempre em memória: ela não toca a URL nem o histórico do hospedeiro.
 */
export type TelaAvulsaProps = Pick<FluxoCalculoProps, 'apiUrl' | 'token' | 'tema' | 'onEvento' | 'onSessaoExpirada'>;

export type InicioProps = TelaAvulsaProps;
export type AdministracaoProps = TelaAvulsaProps;
export type AuditoriaProps = TelaAvulsaProps;

interface DefinicaoAvulsa {
  /** Nome da tela: rótulo da região que a envolve. */
  nome: string;
  /** O nome com o artigo, para os estados de carregando e erro (ex.: `a Auditoria`). */
  alvo: string;
  /** Quem pode ver a tela no cliente atual, e o título do estado "sem acesso". Sem ele, a tela é aberta a todos. */
  acesso?: {
    permitida: (temPermissao: (codigo: string) => boolean) => boolean;
    semAcesso: string;
  };
  conteudo: ReactNode;
}

/**
 * Uma tela do módulo montada sozinha: o provedor interno (raiz, API, cache e encerramento da sessão), a espera da
 * sessão, a conferência da permissão e um roteador em memória, isolado do roteador do hospedeiro. Sem menu nem abas
 * do módulo: só a tela, numa região nomeada (a página do hospedeiro já tem o `main` dela).
 */
function TelaAvulsa({ definicao, ...props }: TelaAvulsaProps & { definicao: DefinicaoAvulsa }) {
  const { apiUrl, token, tema, onSessaoExpirada } = props;
  return (
    <ProvedorModulo apiUrl={apiUrl} token={token} tema={tema} onSessaoExpirada={onSessaoExpirada}>
      <section className="fc-modulo-conteudo" aria-label={definicao.nome}>
        <ConteudoAvulso definicao={definicao} />
      </section>
    </ProvedorModulo>
  );
}

function ConteudoAvulso({ definicao }: { definicao: DefinicaoAvulsa }) {
  const sessao = useSessao();

  // Com uma sessão no cache, um erro numa nova busca não tira a tela; sem ela, mostra o estado da busca.
  if (!sessao.data) {
    if (sessao.isError) {
      return (
        <ErroModulo
          alvo={definicao.alvo}
          erro={sessao.error}
          tentando={sessao.isFetching}
          aoTentarDeNovo={() => void sessao.refetch()}
        />
      );
    }
    return <CarregandoModulo alvo={definicao.alvo} />;
  }

  const { acesso } = definicao;
  if (acesso && !acesso.permitida(sessao.temPermissao)) return <SemAcesso titulo={acesso.semAcesso} />;

  return (
    <Roteador navegacao="memoria" caminhoInicial="/">
      <div className="fc-modulo-pagina">{definicao.conteudo}</div>
    </Roteador>
  );
}

const INICIO: DefinicaoAvulsa = {
  nome: 'Início',
  alvo: 'o Início',
  conteudo: <TelaInicio />,
};

const AUDITORIA: DefinicaoAvulsa = {
  nome: 'Auditoria',
  alvo: 'a Auditoria',
  acesso: {
    permitida: (temPermissao) => temPermissao('auditoria.ver'),
    semAcesso: 'Você não tem acesso à Auditoria',
  },
  conteudo: <TelaAuditoria />,
};

const ADMINISTRACAO: DefinicaoAvulsa = {
  nome: 'Administração',
  alvo: 'a Administração',
  acesso: {
    // Basta uma área: a tela mostra só as abas permitidas.
    permitida: (temPermissao) => Object.values(PERMISSOES_ADMINISTRACAO).some(temPermissao),
    semAcesso: 'Você não tem acesso à Administração',
  },
  conteudo: <TelaAdministracao />,
};

/** A tela Início, sozinha, fora do `<FluxoCalculo>`. Aberta a todos. */
export function Inicio(props: InicioProps) {
  return <TelaAvulsa {...props} definicao={INICIO} />;
}

/**
 * A Administração, sozinha, fora do `<FluxoCalculo>`: as abas Usuários, Papéis, Integração e Segurança que a pessoa
 * pode ver, trocadas sem mexer na URL. Sem nenhuma delas, mostra o estado "sem acesso".
 */
export function Administracao(props: AdministracaoProps) {
  return <TelaAvulsa {...props} definicao={ADMINISTRACAO} />;
}

/** A Auditoria, sozinha, fora do `<FluxoCalculo>`. Pede `auditoria.ver`; sem ela, mostra o estado "sem acesso". */
export function Auditoria(props: AuditoriaProps) {
  return <TelaAvulsa {...props} definicao={AUDITORIA} />;
}
