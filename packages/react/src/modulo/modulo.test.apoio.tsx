// Apoio aos testes da vertical (não é um teste nem vai para o pacote): API simulada por rota, respostas do contrato,
// telas de exemplo e os recursos do navegador que o jsdom não tem (ResizeObserver controlável, captura de ponteiro).
import { vi } from 'vitest';
import type { Sessao } from '../sessao';
import type { DefinicaoTela } from './telas';

export const API = 'https://api.teste';

export const TENANT_MATRIZ = { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' };
export const TENANT_FILIAL = { id: '00000000-0000-0000-0000-00000000000b', nome: 'Filial Nordeste e Centro-Oeste' };

export const sessaoMatriz: Sessao = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana Beatriz Souza', email: 'ana@exemplo.com' },
  tenants: [TENANT_MATRIZ, TENANT_FILIAL],
  tenant_atual: TENANT_MATRIZ,
  permissoes: ['workflows.ver', 'execucoes.ver'],
};

export const sessaoFilial: Sessao = { ...sessaoMatriz, tenant_atual: TENANT_FILIAL, permissoes: ['auditoria.ver'] };

export const sessaoUmCliente: Sessao = { ...sessaoMatriz, tenants: [TENANT_MATRIZ] };

/** Telas de exemplo: uma livre, uma por `workflows.ver` e uma por `auditoria.ver`. */
export const telasDeTeste: readonly DefinicaoTela[] = [
  { id: 'inicio', rotulo: 'Início', caminho: 'inicio', icone: null, conteudo: <h1>Tela Início</h1> },
  {
    id: 'workflows',
    rotulo: 'Workflows',
    caminho: 'workflows',
    icone: null,
    permissao: 'workflows.ver',
    conteudo: <h1>Tela Workflows</h1>,
  },
  {
    id: 'auditoria',
    rotulo: 'Auditoria',
    caminho: 'auditoria',
    icone: null,
    permissao: 'auditoria.ver',
    conteudo: <h1>Tela Auditoria</h1>,
  },
];

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

export function semConteudo(): Response {
  return new Response(null, { status: 204 });
}

/** Erro problem+json do contrato. */
export function problema(status: number, codigo: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${codigo}.`, codigo }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Resposta = Response | Promise<Response>;
type Rotas = Record<string, Resposta | ((requisicao: Request) => Resposta)>;

export type FetchSimulado = ReturnType<typeof vi.fn<(requisicao: Request) => Promise<Response>>>;

/**
 * Troca o fetch global por uma API simulada: cada chave é "MÉTODO /caminho" e vale para todas as chamadas, até ser
 * trocada com `definir`. Rota não prevista responde 404. Desfaça com `vi.unstubAllGlobals()`.
 */
export function simularApi(rotas: Rotas) {
  const atuais: Rotas = { ...rotas };
  const fetchSimulado: FetchSimulado = vi.fn(async (requisicao: Request) => {
    const chave = `${requisicao.method} ${new URL(requisicao.url).pathname}`;
    const resposta = atuais[chave];
    if (resposta === undefined) return problema(404, 'nao_encontrado');
    // Uma Response só pode ser lida uma vez: cada chamada recebe uma cópia.
    const pronta = await (typeof resposta === 'function' ? resposta(requisicao) : resposta);
    return pronta.clone();
  });
  vi.stubGlobal('fetch', fetchSimulado);
  return {
    fetchSimulado,
    definir(novas: Rotas) {
      Object.assign(atuais, novas);
    },
    /** As requisições feitas, como "MÉTODO /caminho". */
    chamadas: () => fetchSimulado.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`),
    requisicao(indice: number): Request {
      const chamada = fetchSimulado.mock.calls[indice];
      if (!chamada) throw new Error(`o fetch não foi chamado ${indice + 1} vez(es)`);
      return chamada[0];
    },
  };
}

/** Uma resposta que só chega quando o teste mandar. */
export function respostaPendente() {
  let entregar: (resposta: Response) => void = () => undefined;
  const promessa = new Promise<Response>((resolver) => {
    entregar = resolver;
  });
  return { promessa, entregar };
}

// ResizeObserver controlável: o layout do casca mede a própria largura (estilos.md §15).
let larguraSimulada = 1440;
const observados = new Set<{ alvo: Element; avisar: ResizeObserverCallback; observador: ResizeObserver }>();

class ResizeObserverSimulado implements ResizeObserver {
  #avisar: ResizeObserverCallback;
  constructor(avisar: ResizeObserverCallback) {
    this.#avisar = avisar;
  }
  observe(alvo: Element) {
    const registro = { alvo, avisar: this.#avisar, observador: this };
    observados.add(registro);
    avisarLargura(registro);
  }
  unobserve(alvo: Element) {
    for (const registro of observados) if (registro.observador === this && registro.alvo === alvo) observados.delete(registro);
  }
  disconnect() {
    for (const registro of observados) if (registro.observador === this) observados.delete(registro);
  }
}

function avisarLargura(registro: { alvo: Element; avisar: ResizeObserverCallback; observador: ResizeObserver }) {
  const entrada = { target: registro.alvo, contentRect: { width: larguraSimulada, height: 800 } } as ResizeObserverEntry;
  registro.avisar([entrada], registro.observador);
}

globalThis.ResizeObserver = ResizeObserverSimulado;

/** Muda a largura que o ResizeObserver informa e avisa quem observa. */
export function simularLargura(largura: number) {
  larguraSimulada = largura;
  for (const registro of [...observados]) avisarLargura(registro);
}

const prototipo = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototipo.hasPointerCapture ??= () => false;
prototipo.setPointerCapture ??= () => {};
prototipo.releasePointerCapture ??= () => {};
prototipo.scrollIntoView ??= () => {};
