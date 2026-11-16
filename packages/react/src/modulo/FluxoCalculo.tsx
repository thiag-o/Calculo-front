import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { criarQueryClient, ProvedorApi } from '../api';
import { RaizFluxo, type TemaFluxo } from '../design-system';
import { useSessao, type Sessao } from '../sessao';
import { LayoutCasca } from './casca/LayoutCasca';
import { ContextoEncerrarSessao } from './encerramento';
import { CarregandoModulo, ErroModulo, SemTelas, SessaoEncerrada } from './EstadosModulo';
import { LayoutIncorporado } from './incorporado/LayoutIncorporado';
import { Roteador, type NavegacaoFluxo } from './roteador/Roteador';
import { agruparPorSecao, telaInicial, TELAS, telasPermitidas, type DefinicaoTela, type TelaFluxo } from './telas';
import './modulo.css';

/**
 * Eventos que o módulo avisa ao hospedeiro (design.md §3: execução concluída, versão publicada…), só para informar.
 * O épico 1 ainda não emite nenhum; cada épico acrescenta os seus a esta união.
 */
export type EventoFluxo = never;

export interface FluxoCalculoProps {
  /** Endereço da API, sem o `/v1`. */
  apiUrl: string;
  /**
   * Token de incorporação, pedido pelo backend do hospedeiro. Com ele, o módulo chama a API com `Authorization:
   * Bearer` e usa o layout incorporado (abas, sem menu lateral). Sem ele, usa o cookie de sessão (app casca).
   */
  token?: string;
  /** Tela em que o módulo abre. Padrão: `inicio`. No modo `url`, a URL atual tem preferência. */
  tela?: TelaFluxo;
  /** Padrão: `sistema`. */
  tema?: TemaFluxo;
  /** `url` (casca) ou `memoria`, que não toca a URL do hospedeiro. Padrão: `memoria` com `token`, `url` sem. */
  navegacao?: NavegacaoFluxo;
  /** Avisos ao hospedeiro (ainda nenhum no épico 1). */
  onEvento?: (evento: EventoFluxo) => void;
  /**
   * Chamado quando não há mais sessão: a API respondeu `401 sem_sessao` (expirou, foi revogada, token vencido) ou
   * a pessoa saiu. No casca, é a hora de voltar ao login; incorporado, de renovar o token.
   */
  onSessaoExpirada?: () => void;
}

/**
 * O Fluxo de Cálculo inteiro (design.md §3 e §15): raiz do módulo (tokens e tema), cliente da API, QueryClient
 * próprio e o roteador (`url` ou `memoria`). No casca, menu lateral com o seletor de cliente; incorporado, abas.
 */
export function FluxoCalculo(props: FluxoCalculoProps) {
  return <ModuloFluxo {...props} telas={TELAS} />;
}

export interface ModuloFluxoProps extends Omit<FluxoCalculoProps, 'tela'> {
  /** As telas do módulo, na ordem do menu. O `<FluxoCalculo>` passa as do produto; os testes passam outras. */
  telas: readonly DefinicaoTela[];
  /** O `id` da tela inicial, entre as `telas`, ou de uma seção (abre a primeira tela dela). */
  tela?: string;
}

/** Encerramento da sessão para um token: vale até o hospedeiro passar outro token. */
interface Encerramento {
  token: string | undefined;
}

export function ModuloFluxo({ apiUrl, token, tela, tema, navegacao, onSessaoExpirada, telas }: ModuloFluxoProps) {
  const [queryClient] = useState(criarQueryClient);
  const incorporado = token !== undefined;
  const modoNavegacao: NavegacaoFluxo = navegacao ?? (incorporado ? 'memoria' : 'url');

  const [encerramento, setEncerramento] = useState<Encerramento | null>(null);
  const encerrada = encerramento !== null && encerramento.token === token;

  // Valores mais recentes, sem recriar o `encerrar` (e a inscrição no cliente) a cada renderização.
  const tokenAtual = useRef(token);
  const avisarHospedeiro = useRef(onSessaoExpirada);
  const ultimoEncerramento = useRef<Encerramento | null>(null);
  useLayoutEffect(() => {
    tokenAtual.current = token;
    avisarHospedeiro.current = onSessaoExpirada;
  }, [token, onSessaoExpirada]);

  const encerrar = useCallback(() => {
    const atual = tokenAtual.current;
    // Várias consultas podem receber o 401 juntas: o hospedeiro é avisado uma vez por token.
    if (ultimoEncerramento.current !== null && ultimoEncerramento.current.token === atual) return;
    ultimoEncerramento.current = { token: atual };
    setEncerramento({ token: atual });
    avisarHospedeiro.current?.();
  }, []);

  // Sem sessão, nada do usuário anterior fica no cache (ADR 0008 e 0015). Roda depois que o layout saiu da tela,
  // para nenhuma consulta montada buscar de novo.
  useEffect(() => {
    if (!encerrada) return;
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [encerrada, queryClient]);

  return (
    <RaizFluxo tema={tema} className="fc-modulo-raiz">
      <ProvedorApi apiUrl={apiUrl} token={token} onSessaoExpirada={encerrar}>
        <QueryClientProvider client={queryClient}>
          <ContextoEncerrarSessao.Provider value={encerrar}>
            {encerrada ? (
              <SessaoEncerrada />
            ) : (
              <ConteudoModulo incorporado={incorporado} navegacao={modoNavegacao} tela={tela} telas={telas} />
            )}
          </ContextoEncerrarSessao.Provider>
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>
  );
}

interface ConteudoModuloProps {
  incorporado: boolean;
  navegacao: NavegacaoFluxo;
  tela: string | undefined;
  telas: readonly DefinicaoTela[];
}

/** Espera a sessão; com ela, monta o roteador e o layout do modo (casca ou incorporado). */
function ConteudoModulo({ incorporado, navegacao, tela, telas }: ConteudoModuloProps) {
  const sessao = useSessao();

  // Com uma sessão no cache, um erro numa nova busca não derruba o módulo; sem ela, mostra o estado da busca.
  if (!sessao.data) {
    if (sessao.isError) {
      return <ErroModulo erro={sessao.error} tentando={sessao.isFetching} aoTentarDeNovo={() => void sessao.refetch()} />;
    }
    return <CarregandoModulo />;
  }

  const visiveis = telasPermitidas(telas, sessao.temPermissao);
  const inicial = telaInicial(visiveis, tela);
  if (!inicial) return <SemTelas />;

  return (
    <Roteador navegacao={navegacao} caminhoInicial={`/${inicial.caminho}`}>
      <RotasDoModulo incorporado={incorporado} sessao={sessao.data} telas={visiveis} inicial={inicial} />
    </Roteador>
  );
}

interface RotasDoModuloProps {
  incorporado: boolean;
  sessao: Sessao;
  telas: readonly DefinicaoTela[];
  inicial: DefinicaoTela;
}

/**
 * Uma rota por tela permitida, e uma por seção, que abre a primeira tela permitida dela. Rota sem permissão ou
 * desconhecida (inclusive depois de trocar de cliente) volta para a tela inicial.
 */
function RotasDoModulo({ incorporado, sessao, telas, inicial }: RotasDoModuloProps) {
  const paraInicial = <Navigate to={`/${inicial.caminho}`} replace />;
  const { secoes } = agruparPorSecao(telas);
  return (
    <Routes>
      <Route element={incorporado ? <LayoutIncorporado telas={telas} /> : <LayoutCasca sessao={sessao} telas={telas} />}>
        <Route index element={paraInicial} />
        {telas.map((definicao) => (
          <Route key={definicao.id} path={definicao.caminho} element={definicao.conteudo} />
        ))}
        {secoes.map((grupo) => (
          <Route
            key={`secao-${grupo.secao}`}
            path={grupo.caminho}
            element={<Navigate to={`/${grupo.telas[0]?.caminho ?? inicial.caminho}`} replace />}
          />
        ))}
        <Route path="*" element={paraInicial} />
      </Route>
    </Routes>
  );
}
