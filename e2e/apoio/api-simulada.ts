// API simulada do modo `simulado` (pnpm e2e): intercepta as chamadas do casca a `/v1/...` com `page.route` e responde
// como o contrato manda, com os exemplos de erro de `contrato.ts`. Guarda estado como o back (sessão, token CSRF,
// falhas de login por e-mail), para os mesmos testes servirem ao modo real.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { EXEMPLOS, type CorpoErro, type Esquemas, type Sessao } from './contrato';

type TenantResumo = Esquemas['TenantResumo'];

/** Uma conta da simulação: credenciais, usuário e permissões por tenant. */
export interface ContaSimulada {
  email: string;
  senha: string;
  nome: string;
  id: string;
  /** Tenant → permissões do usuário nele. */
  tenants: ReadonlyArray<{ tenant: TenantResumo; permissoes: readonly string[] }>;
}

/** Regras de login do back (G4 e D3–D8): 5 falhas seguidas bloqueiam o e-mail por 15 minutos. */
const TENTATIVAS_ATE_BLOQUEAR = 5;
const DURACAO_BLOQUEIO_MS = 15 * 60 * 1000;

const COOKIE_CSRF = 'fc_csrf';
const COOKIE_SESSAO = 'fc_sessao';
const CABECALHO_CSRF = 'x-csrf-token';

interface SessaoAberta {
  conta: ContaSimulada;
  tenantAtualId: string;
  csrf: string;
}

/** Requisição recebida pela simulação, para o teste conferir o que o casca mandou. */
export interface RequisicaoRecebida {
  metodo: string;
  caminho: string;
  cabecalhos: Record<string, string>;
}

function compararNome(a: TenantResumo, b: TenantResumo): number {
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

/**
 * A API do épico 1 (`/v1/saude`, `/v1/sessao`, `/v1/sessao/tenant`), em memória, uma por teste.
 * Rota fora do contrato responde 501 e fica em `naoPrevistas`; a fixture reprova o teste se houver alguma.
 */
export class ApiSimulada {
  readonly recebidas: RequisicaoRecebida[] = [];
  readonly naoPrevistas: string[] = [];

  private sessao: SessaoAberta | null = null;
  /** E-mail (sem diferença de maiúsculas) → instantes das falhas desde o último sucesso. */
  private readonly falhas = new Map<string, number[]>();
  /** E-mail → último tenant usado (a sessão nova começa nele). */
  private readonly ultimoTenant = new Map<string, string>();

  constructor(
    private readonly contas: readonly ContaSimulada[],
    private readonly agora: () => number = Date.now,
  ) {}

  /** Liga a simulação na página: toda chamada a `/v1/...` fora da origem do casca cai aqui. */
  async instalar(page: Page, origemCasca: string): Promise<void> {
    const context = page.context();
    await page.route(
      (url) => url.pathname.startsWith('/v1/') && url.origin !== origemCasca,
      (route) => this.responder(route, context, origemCasca),
    );
  }

  private async responder(route: Route, context: BrowserContext, origemCasca: string): Promise<void> {
    const requisicao = route.request();
    const url = new URL(requisicao.url());
    const metodo = requisicao.method().toUpperCase();
    const cors = cabecalhosCors(requisicao, origemCasca);

    if (metodo === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': 'content-type, x-csrf-token',
        },
      });
      return;
    }

    this.recebidas.push({ metodo, caminho: url.pathname, cabecalhos: await requisicao.allHeaders() });
    const resposta = await this.tratar(metodo, url.pathname, requisicao, context);
    await route.fulfill({
      status: resposta.status,
      headers: { ...cors, ...(resposta.corpo === undefined ? {} : { 'content-type': resposta.tipo }) },
      body: resposta.corpo === undefined ? undefined : JSON.stringify(resposta.corpo),
    });
  }

  private async tratar(metodo: string, caminho: string, requisicao: Request, context: BrowserContext): Promise<Resposta> {
    const rota = `${metodo} ${caminho}`;
    switch (rota) {
      case 'GET /v1/saude':
        return json(200, { status: 'ok' } satisfies Esquemas['Saude']);
      case 'POST /v1/sessao':
        return this.entrar(requisicao, context);
      case 'GET /v1/sessao':
        return this.sessao ? json(200, this.corpoSessao(this.sessao)) : problema(EXEMPLOS.SemSessao);
      case 'DELETE /v1/sessao':
        return this.sair(requisicao, context);
      case 'PUT /v1/sessao/tenant':
        return this.trocarTenant(requisicao);
      default:
        this.naoPrevistas.push(rota);
        return problema({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: rota, codigo: 'rota_nao_simulada' });
    }
  }

  /** `POST /v1/sessao`: ordem das recusas do contrato (415/422, bloqueio 423, credenciais 401). */
  private async entrar(requisicao: Request, context: BrowserContext): Promise<Resposta> {
    if (!ehJson(requisicao)) return problema(EXEMPLOS.TipoConteudoInvalido);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(EXEMPLOS.DadosInvalidosJsonMalformado);
    const campos: Record<string, string> = {};
    if (typeof corpo.email !== 'string') campos.email = 'Informe o e-mail.';
    if (typeof corpo.senha !== 'string') campos.senha = 'Informe a senha.';
    if (Object.keys(campos).length > 0) return problema({ ...EXEMPLOS.DadosInvalidos, campos });
    const email = corpo.email as string;
    const senha = corpo.senha as string;

    const agora = this.agora();
    const chave = email.toLocaleLowerCase('en-US');
    const fimBloqueio = this.desbloqueiaEm(chave, agora);
    if (fimBloqueio !== null) {
      return problema({ ...EXEMPLOS.LoginBloqueado, desbloqueia_em: new Date(fimBloqueio).toISOString() });
    }

    const conta = this.contas.find((c) => c.email.toLocaleLowerCase('en-US') === chave);
    if (!conta || conta.senha !== senha) {
      this.falhas.set(chave, [...(this.falhas.get(chave) ?? []), agora]);
      return problema(EXEMPLOS.CredenciaisInvalidas);
    }

    this.falhas.delete(chave);
    const tenants = [...conta.tenants.map((t) => t.tenant)].sort(compararNome);
    const ultimo = this.ultimoTenant.get(chave);
    const inicial = tenants.find((t) => t.id === ultimo) ?? tenants[0];
    if (!inicial) return problema(EXEMPLOS.CredenciaisInvalidas);

    this.sessao = { conta, tenantAtualId: inicial.id, csrf: randomUUID() };
    // Os dois cookies do login (contrato, SetCookieLogin), no host da API.
    const urlApi = new URL(requisicao.url()).origin;
    await context.addCookies([
      { name: COOKIE_SESSAO, value: randomUUID(), url: urlApi, httpOnly: true, sameSite: 'Lax' },
      { name: COOKIE_CSRF, value: this.sessao.csrf, url: urlApi, sameSite: 'Lax' },
    ]);
    return json(200, this.corpoSessao(this.sessao));
  }

  /** `DELETE /v1/sessao`: exige o CSRF; apaga a sessão e os dois cookies. */
  private async sair(requisicao: Request, context: BrowserContext): Promise<Resposta> {
    if (!this.sessao) return problema(EXEMPLOS.SemSessao);
    if (!csrfConfere(requisicao, this.sessao)) return problema(EXEMPLOS.CsrfInvalido);
    this.sessao = null;
    await context.clearCookies({ name: COOKIE_SESSAO });
    await context.clearCookies({ name: COOKIE_CSRF });
    return { status: 204, tipo: 'application/json', corpo: undefined };
  }

  /** `PUT /v1/sessao/tenant`: exige sessão e CSRF; só para um tenant do usuário. */
  private trocarTenant(requisicao: Request): Resposta {
    const sessao = this.sessao;
    if (!sessao) return problema(EXEMPLOS.SemSessao);
    if (!csrfConfere(requisicao, sessao)) return problema(EXEMPLOS.CsrfInvalido);
    if (!ehJson(requisicao)) return problema(EXEMPLOS.DadosInvalidosJsonMalformado);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(EXEMPLOS.DadosInvalidosJsonMalformado);
    const tenantId = corpo.tenant_id;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return problema(EXEMPLOS.DadosInvalidos);
    if (!sessao.conta.tenants.some((t) => t.tenant.id === tenantId)) return problema(EXEMPLOS.SemAcessoAoTenant);
    sessao.tenantAtualId = tenantId;
    this.ultimoTenant.set(sessao.conta.email.toLocaleLowerCase('en-US'), tenantId);
    return json(200, this.corpoSessao(sessao));
  }

  /** Igual a `desbloqueia_em` do domínio do back: a 5ª falha seguida bloqueia por 15 min, contados dela. */
  private desbloqueiaEm(chave: string, agora: number): number | null {
    let fim: number | null = null;
    let seguidas = 0;
    for (const falha of [...(this.falhas.get(chave) ?? [])].sort((a, b) => a - b)) {
      if (fim !== null) {
        if (falha < fim) continue;
        fim = null;
      }
      seguidas += 1;
      if (seguidas >= TENTATIVAS_ATE_BLOQUEAR) {
        fim = falha + DURACAO_BLOQUEIO_MS;
        seguidas = 0;
      }
    }
    return fim !== null && agora < fim ? fim : null;
  }

  private corpoSessao({ conta, tenantAtualId }: SessaoAberta): Sessao {
    const tenants = [...conta.tenants].sort((a, b) => compararNome(a.tenant, b.tenant));
    const atual = tenants.find((t) => t.tenant.id === tenantAtualId) ?? tenants[0];
    if (!atual) throw new Error(`Conta simulada sem tenant: ${conta.email}`);
    return {
      usuario: { id: conta.id, nome: conta.nome, email: conta.email },
      tenants: tenants.map((t) => t.tenant),
      tenant_atual: atual.tenant,
      permissoes: [...atual.permissoes],
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Resposta {
  status: number;
  tipo: 'application/json' | 'application/problem+json';
  corpo: unknown;
}

function json(status: number, corpo: unknown): Resposta {
  return { status, tipo: 'application/json', corpo };
}

function problema(exemplo: CorpoErro): Resposta {
  return { status: exemplo.status, tipo: 'application/problem+json', corpo: exemplo };
}

function cabecalhosCors(requisicao: Request, origemCasca: string): Record<string, string> {
  return {
    'access-control-allow-origin': requisicao.headers().origin ?? origemCasca,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
}

function ehJson(requisicao: Request): boolean {
  const tipo = requisicao.headers()['content-type'] ?? '';
  return tipo.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

function lerJson(requisicao: Request): Record<string, unknown> | undefined {
  try {
    const corpo: unknown = requisicao.postDataJSON();
    return corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function csrfConfere(requisicao: Request, sessao: SessaoAberta): boolean {
  return requisicao.headers()[CABECALHO_CSRF] === sessao.csrf;
}
