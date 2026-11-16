// API simulada do épico 2 (pnpm e2e): sessão por cookie e por token, usuários, papéis, link de redefinição, chaves de
// API, domínios autorizados, incorporação, auditoria de acessos e configuração de segurança, em memória, uma por teste.
//
// Responde como o contrato (../backend/contratos/openapi.yaml) e como o domínio do back (catálogo de permissões, papéis
// iniciais, regras do login e da senha, texto do detalhe da auditoria), com os exemplos de erro do contrato. Guarda o
// estado entre as páginas de um teste: o Admin cria um usuário numa página e a pessoa entra em outra.
import { randomBytes, randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { ehChamadaDaApi, ROTAS_DA_API } from '../../apoio/api-simulada';
import { EXEMPLOS, type CorpoErro, type Esquemas, type Sessao } from '../../apoio/contrato';

type CodigoPermissao = Esquemas['CodigoPermissao'];
type CampoSeguranca = keyof Esquemas['AlteracaoConfiguracaoSeguranca'];

const ERROS = EXEMPLOS;

/** O catálogo do back (`identidade/dominio/permissoes.py` e os nomes de `GET /v1/permissoes`), na ordem dele. */
const CATALOGO: readonly Esquemas['Permissao'][] = [
  { codigo: 'usuarios.gerenciar', nome: 'Gerenciar usuários', grupo: 'Administração', sensivel: false },
  { codigo: 'papeis.gerenciar', nome: 'Gerenciar papéis', grupo: 'Administração', sensivel: false },
  { codigo: 'integracao.gerenciar', nome: 'Gerenciar integração', grupo: 'Administração', sensivel: false },
  { codigo: 'seguranca.gerenciar', nome: 'Gerenciar segurança', grupo: 'Administração', sensivel: true },
  { codigo: 'conexoes.ver', nome: 'Ver conexões', grupo: 'Dados', sensivel: false },
  { codigo: 'conexoes.gerenciar', nome: 'Gerenciar conexões', grupo: 'Dados', sensivel: false },
  { codigo: 'credenciais.gerenciar', nome: 'Gerenciar credenciais', grupo: 'Dados', sensivel: true },
  { codigo: 'datasets.gerenciar', nome: 'Gerenciar datasets', grupo: 'Dados', sensivel: false },
  { codigo: 'sql_livre.usar', nome: 'Usar SQL livre', grupo: 'Dados', sensivel: false },
  { codigo: 'variaveis.gerenciar', nome: 'Gerenciar variáveis', grupo: 'Dados', sensivel: false },
  { codigo: 'workflows.ver', nome: 'Ver workflows', grupo: 'Workflows', sensivel: false },
  { codigo: 'workflows.editar', nome: 'Editar workflows', grupo: 'Workflows', sensivel: false },
  { codigo: 'testes.editar', nome: 'Editar testes', grupo: 'Workflows', sensivel: false },
  {
    codigo: 'teste.alterar_origem_cliente',
    nome: 'Aceitar alteração de teste de origem cliente',
    grupo: 'Workflows',
    sensivel: true,
  },
  { codigo: 'versao.enviar_revisao', nome: 'Enviar versão para revisão', grupo: 'Workflows', sensivel: false },
  { codigo: 'versao.aprovar', nome: 'Aprovar versão', grupo: 'Workflows', sensivel: true },
  { codigo: 'versao.publicar', nome: 'Publicar versão', grupo: 'Workflows', sensivel: false },
  { codigo: 'execucoes.ver', nome: 'Ver execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucoes.disparar', nome: 'Disparar execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucoes.agendar', nome: 'Agendar execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucao.reprocessar', nome: 'Reprocessar execução', grupo: 'Execuções', sensivel: true },
  { codigo: 'erro.ignorar', nome: 'Ignorar erro', grupo: 'Execuções', sensivel: true },
  { codigo: 'simulacao.rodar', nome: 'Rodar simulação', grupo: 'Execuções', sensivel: false },
  { codigo: 'estados.ver', nome: 'Ver estados', grupo: 'Estados', sensivel: false },
  { codigo: 'estado.ajustar', nome: 'Ajustar estado', grupo: 'Estados', sensivel: true },
  { codigo: 'auditoria.ver', nome: 'Ver auditoria', grupo: 'Auditoria', sensivel: false },
  { codigo: 'traces.ver', nome: 'Ver traces', grupo: 'Auditoria', sensivel: false },
];

const CODIGOS: readonly CodigoPermissao[] = CATALOGO.map((permissao) => permissao.codigo);
const ADMIN = 'Admin';

/** Os papéis criados em todo tenant novo (`PAPEIS_INICIAIS` do back). O Admin é o fixo, com todas as permissões. */
const PAPEIS_INICIAIS: Readonly<Record<string, readonly CodigoPermissao[]>> = {
  [ADMIN]: CODIGOS,
  Integrador: CATALOGO.filter((permissao) => permissao.grupo === 'Dados').map((permissao) => permissao.codigo),
  Configurador: [
    'workflows.ver',
    'workflows.editar',
    'testes.editar',
    'versao.enviar_revisao',
    'simulacao.rodar',
    'conexoes.ver',
    'execucoes.ver',
  ],
  Aprovador: ['workflows.ver', 'versao.aprovar', 'versao.publicar', 'teste.alterar_origem_cliente', 'simulacao.rodar', 'execucoes.ver'],
  Operador: [
    'workflows.ver',
    'execucoes.ver',
    'execucoes.disparar',
    'execucoes.agendar',
    'execucao.reprocessar',
    'erro.ignorar',
    'estados.ver',
    'estado.ajustar',
  ],
  Auditor: CODIGOS.filter((codigo) => codigo.endsWith('.ver')),
};

/** Padrão e limites (inclusivos) de cada parâmetro de segurança do tenant (contrato, `GET /v1/configuracoes/seguranca`). */
const SEGURANCA: Readonly<Record<CampoSeguranca, { padrao: number; minimo: number; maximo: number }>> = {
  inatividade_minutos: { padrao: 480, minimo: 15, maximo: 1440 },
  duracao_maxima_dias: { padrao: 7, minimo: 1, maximo: 30 },
  senha_minima: { padrao: 12, minimo: 8, maximo: 64 },
  validade_link_horas: { padrao: 24, minimo: 1, maximo: 72 },
  validade_token_minutos: { padrao: 15, minimo: 5, maximo: 60 },
};
const CAMPOS_SEGURANCA = Object.keys(SEGURANCA) as CampoSeguranca[];

const TIPOS_EVENTO = [
  'login_ok',
  'login_falhou',
  'login_bloqueado',
  'logout',
  'troca_tenant',
  'redefinicao_gerada',
  'senha_redefinida',
  'chave_api_criada',
  'chave_api_revogada',
  'token_incorporacao_emitido',
  'papel_alterado',
  'usuario_alterado',
  'seguranca_alterada',
] as const;
type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Regras do login do sistema (G4): 5 falhas seguidas bloqueiam o e-mail por 15 minutos. */
const TENTATIVAS_ATE_BLOQUEAR = 5;
const DURACAO_BLOQUEIO_MS = 15 * 60 * 1000;
const LIMITE_PADRAO = 50;
const IP = '127.0.0.1';

const COOKIE_CSRF = 'fc_csrf';
const COOKIE_SESSAO = 'fc_sessao';
const METODOS_COM_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Recursos com `{id}` no caminho (`/v1/<recurso>/{id}...`). */
const COM_ID = new Set(['papeis', 'usuarios', 'chaves-api', 'dominios-autorizados']);

/** Uma conta que já existe quando o teste começa (como as do `preparar-local`). */
export interface ContaInicial {
  email: string;
  senha: string;
  nome: string;
  /** Nome do tenant → nome do papel do usuário nele. */
  papeis: Readonly<Record<string, string>>;
}

interface Usuario {
  id: string;
  email: string;
  nome: string;
  senha: string | null;
  /** `id_externo` do hospedeiro, para o usuário criado pela incorporação. */
  idExterno: string | null;
  ultimoTenant: string | null;
}

interface Membro {
  tenantId: string;
  usuarioId: string;
  papeis: Set<string>;
  ativo: boolean;
}

interface Papel {
  id: string;
  tenantId: string;
  nome: string;
  permissoes: CodigoPermissao[];
  fixo: boolean;
}

interface Tenant {
  id: string;
  nome: string;
  seguranca: Record<CampoSeguranca, number>;
}

interface Chave {
  id: string;
  tenantId: string;
  nome: string;
  prefixo: string;
  chave: string;
  criadaEm: number;
  ultimoUsoEm: number | null;
  revogadaEm: number | null;
}

interface Dominio {
  id: string;
  tenantId: string;
  origem: string;
  criadoEm: number;
}

interface LinkRedefinicao {
  token: string;
  usuarioId: string;
  tenantId: string;
  expiraEm: number;
  usado: boolean;
}

interface Evento {
  id: string;
  ordem: number;
  ocorridoEm: number;
  tipo: TipoEvento;
  usuarioId: string | null;
  email: string;
  detalhe: string | null;
  tenantId: string | null;
}

interface SessaoCookie {
  usuarioId: string;
  tenantId: string;
  csrf: string;
}

interface TokenIncorporacao {
  usuarioId: string;
  tenantId: string;
  expiraEm: number;
}

/** Quem chama: o usuário, o tenant e as permissões dele nesse tenant. */
interface Autenticacao {
  usuario: Usuario;
  tenantId: string;
  permissoes: ReadonlySet<string>;
  modo: 'cookie' | 'token';
}

interface Resposta {
  status: number;
  tipo: 'application/json' | 'application/problem+json';
  corpo: unknown;
}

/**
 * A API do épico 2 em memória. Toda chamada a `/v1/...` fora da origem do casca cai aqui (`instalar`); a sessão por
 * cookie é guardada por contexto do navegador, como o cookie. Rota fora do contrato responde 501 e fica em
 * `naoPrevistas`; a fixture reprova o teste se houver alguma.
 */
export class SimulacaoEpico2 {
  readonly naoPrevistas: string[] = [];

  private readonly tenants: Tenant[] = [];
  private readonly usuarios: Usuario[] = [];
  private readonly membros: Membro[] = [];
  private readonly papeis: Papel[] = [];
  private readonly chaves: Chave[] = [];
  private readonly dominios: Dominio[] = [];
  private readonly links: LinkRedefinicao[] = [];
  private readonly eventos: Evento[] = [];
  private readonly sessoes = new Map<BrowserContext, SessaoCookie>();
  private readonly tokens = new Map<string, TokenIncorporacao>();
  /** E-mail (sem diferença de maiúsculas) → instantes das falhas desde o último sucesso. */
  private readonly falhas = new Map<string, number[]>();

  constructor(
    contas: readonly ContaInicial[],
    /** Endereço do casca: a base do link de redefinição (`FLUXO_URL_CASCA` do back). */
    private readonly urlCasca: string,
    private readonly agora: () => number = Date.now,
  ) {
    for (const nome of new Set(contas.flatMap((conta) => Object.keys(conta.papeis)))) this.criarTenant(nome);
    for (const conta of contas) {
      const usuario = this.criarUsuario(conta.email, conta.nome, conta.senha, null);
      for (const [nomeTenant, nomePapel] of Object.entries(conta.papeis)) {
        const tenant = this.tenants.find((t) => t.nome === nomeTenant);
        const papel = this.papeis.find((p) => p.tenantId === tenant?.id && p.nome === nomePapel);
        if (!tenant || !papel) throw new Error(`Conta inicial com tenant ou papel desconhecido: ${conta.email}.`);
        this.membros.push({ tenantId: tenant.id, usuarioId: usuario.id, papeis: new Set([papel.id]), ativo: true });
      }
    }
  }

  /** Liga a simulação numa página (e no contexto dela): toda chamada a `/v1/...` fora da origem do casca cai aqui. */
  async instalar(page: Page): Promise<void> {
    const contexto = page.context();
    const origemCasca = new URL(this.urlCasca).origin;
    await page.route(ROTAS_DA_API, (route) =>
      ehChamadaDaApi(route, origemCasca) ? this.responder(route, contexto) : route.fallback(),
    );
  }

  // --- Entrada -------------------------------------------------------------------------------------------------------

  private async responder(route: Route, contexto: BrowserContext): Promise<void> {
    const requisicao = route.request();
    const metodo = requisicao.method().toUpperCase();
    const cors = {
      'access-control-allow-origin': requisicao.headers().origin ?? this.urlCasca,
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
    };
    if (metodo === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': 'authorization, content-type, x-csrf-token',
        },
      });
      return;
    }
    const resposta = await this.tratar(metodo, new URL(requisicao.url()), requisicao, contexto);
    await route.fulfill({
      status: resposta.status,
      headers: { ...cors, ...(resposta.corpo === undefined ? {} : { 'content-type': resposta.tipo }) },
      body: resposta.corpo === undefined ? undefined : JSON.stringify(resposta.corpo),
    });
  }

  private async tratar(metodo: string, url: URL, requisicao: Request, contexto: BrowserContext): Promise<Resposta> {
    const partes = url.pathname.split('/');
    let id: string | undefined;
    if (partes.length >= 4 && COM_ID.has(partes[2] ?? '')) {
      id = partes[3];
      partes[3] = '{id}';
    }
    const rota = `${metodo} ${partes.join('/')}`;
    if (id !== undefined && !UUID.test(id)) return problema(ERROS.DadosInvalidosId);
    const comId = id ?? '';

    // Rotas públicas e do login.
    switch (rota) {
      case 'GET /v1/saude':
        return json(200, { status: 'ok' } satisfies Esquemas['Saude']);
      case 'POST /v1/sessao':
        return this.entrar(requisicao, contexto);
      case 'POST /v1/redefinicao/verificacao':
        return this.verificarLink(requisicao);
      case 'POST /v1/redefinicao':
        return this.redefinirSenha(requisicao);
      case 'POST /v1/incorporacao/sessoes':
        return this.emitirToken(requisicao);
    }

    const conhecida = ROTAS_AUTENTICADAS.has(rota);
    if (!conhecida) {
      this.naoPrevistas.push(rota);
      return problema({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: rota, codigo: 'rota_nao_simulada' });
    }

    const quem = this.autenticar(metodo, requisicao, contexto);
    if (ehResposta(quem)) return quem;

    switch (rota) {
      case 'GET /v1/sessao':
        return json(200, this.corpoSessao(quem));
      case 'DELETE /v1/sessao':
        return this.sair(quem, contexto);
      case 'PUT /v1/sessao/tenant':
        return this.trocarTenant(quem, requisicao, contexto);
      case 'GET /v1/permissoes':
        return exigir(quem, ['papeis.gerenciar']) ?? json(200, { itens: CATALOGO });
      case 'GET /v1/papeis':
        return exigir(quem, ['papeis.gerenciar', 'usuarios.gerenciar']) ?? json(200, { itens: this.papeisDoTenant(quem.tenantId) });
      case 'POST /v1/papeis':
        return exigir(quem, ['papeis.gerenciar']) ?? this.criarPapel(quem, requisicao);
      case 'GET /v1/papeis/{id}':
        return exigir(quem, ['papeis.gerenciar']) ?? this.obterPapel(quem, comId);
      case 'PUT /v1/papeis/{id}':
        return exigir(quem, ['papeis.gerenciar']) ?? this.alterarPapel(quem, comId, requisicao);
      case 'DELETE /v1/papeis/{id}':
        return exigir(quem, ['papeis.gerenciar']) ?? this.removerPapel(quem, comId);
      case 'GET /v1/usuarios':
        return exigir(quem, ['usuarios.gerenciar']) ?? this.listarUsuarios(quem, url);
      case 'POST /v1/usuarios':
        return exigir(quem, ['usuarios.gerenciar']) ?? this.criarMembro(quem, requisicao);
      case 'GET /v1/usuarios/{id}':
        return exigir(quem, ['usuarios.gerenciar']) ?? this.obterUsuario(quem, comId);
      case 'PUT /v1/usuarios/{id}':
        return exigir(quem, ['usuarios.gerenciar']) ?? this.alterarMembro(quem, comId, requisicao);
      case 'POST /v1/usuarios/{id}/redefinicao':
        return exigir(quem, ['usuarios.gerenciar']) ?? this.gerarLink(quem, comId);
      case 'GET /v1/chaves-api':
        return exigir(quem, ['integracao.gerenciar']) ?? this.listarChaves(quem);
      case 'POST /v1/chaves-api':
        return exigir(quem, ['integracao.gerenciar']) ?? this.criarChave(quem, requisicao);
      case 'DELETE /v1/chaves-api/{id}':
        return exigir(quem, ['integracao.gerenciar']) ?? this.revogarChave(quem, comId);
      case 'GET /v1/dominios-autorizados':
        return exigir(quem, ['integracao.gerenciar']) ?? this.listarDominios(quem);
      case 'POST /v1/dominios-autorizados':
        return exigir(quem, ['integracao.gerenciar']) ?? this.criarDominio(quem, requisicao);
      case 'DELETE /v1/dominios-autorizados/{id}':
        return exigir(quem, ['integracao.gerenciar']) ?? this.removerDominio(quem, comId);
      case 'GET /v1/auditoria/acessos':
        return exigir(quem, ['auditoria.ver']) ?? this.listarAcessos(quem, url);
      case 'GET /v1/configuracoes/seguranca':
        return exigir(quem, ['seguranca.gerenciar']) ?? json(200, this.corpoSeguranca(quem.tenantId));
      case 'PUT /v1/configuracoes/seguranca':
        return exigir(quem, ['seguranca.gerenciar']) ?? this.alterarSeguranca(quem, requisicao);
      default:
        throw new Error(`Rota autenticada sem tratamento: ${rota}`);
    }
  }

  /**
   * Com `Authorization: Bearer`, o token de incorporação, só de um domínio autorizado do tenant dele; sem ele, a sessão
   * do cookie deste contexto, com o `X-CSRF-Token` nas mutações.
   */
  private autenticar(metodo: string, requisicao: Request, contexto: BrowserContext): Autenticacao | Resposta {
    const cabecalhos = requisicao.headers();
    const autorizacao = cabecalhos.authorization ?? '';
    if (autorizacao.startsWith('Bearer ')) {
      const token = this.tokens.get(autorizacao.slice('Bearer '.length));
      if (!token || this.agora() >= token.expiraEm) return problema(ERROS.SemSessao);
      const usuario = this.usuario(token.usuarioId);
      const membro = this.membro(token.tenantId, token.usuarioId);
      if (!usuario || !membro?.ativo) return problema(ERROS.SemSessao);
      const origem = cabecalhos.origin;
      if (!this.dominios.some((d) => d.tenantId === token.tenantId && d.origem === origem)) {
        return problema(ERROS.OrigemNaoAutorizada);
      }
      return { usuario, tenantId: token.tenantId, permissoes: this.permissoesDe(membro), modo: 'token' };
    }

    const sessao = this.sessoes.get(contexto);
    const usuario = sessao ? this.usuario(sessao.usuarioId) : undefined;
    const membro = sessao ? this.membro(sessao.tenantId, sessao.usuarioId) : undefined;
    if (!sessao || !usuario || !membro?.ativo) return problema(ERROS.SemSessao);
    if (METODOS_COM_CSRF.has(metodo) && cabecalhos['x-csrf-token'] !== sessao.csrf) return problema(ERROS.CsrfInvalido);
    return { usuario, tenantId: sessao.tenantId, permissoes: this.permissoesDe(membro), modo: 'cookie' };
  }

  // --- Sessão (épico 1, com a auditoria) ------------------------------------------------------------------------------

  /** `POST /v1/sessao`: ordem das recusas do contrato (415/422, bloqueio 423, credenciais 401). */
  private async entrar(requisicao: Request, contexto: BrowserContext): Promise<Resposta> {
    if (!ehJson(requisicao)) return problema(ERROS.TipoConteudoInvalido);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const { email, senha } = corpo;
    if (typeof email !== 'string' || typeof senha !== 'string') {
      const campos: Record<string, string> = {};
      if (typeof email !== 'string') campos.email = 'Informe o e-mail.';
      if (typeof senha !== 'string') campos.senha = 'Informe a senha.';
      return problema({ ...ERROS.DadosInvalidos, campos });
    }

    const agora = this.agora();
    const chave = email.toLocaleLowerCase('en-US');
    const usuario = this.usuarioPorEmail(email);
    const auditar = (tipo: TipoEvento, tenantId: string | null = null, detalhe: string | null = null) =>
      this.auditar({ tipo, email, usuarioId: usuario?.id ?? null, tenantId, detalhe });

    const fimBloqueio = this.desbloqueiaEm(chave, agora);
    if (fimBloqueio !== null) {
      const desbloqueiaEm = new Date(fimBloqueio).toISOString();
      auditar('login_bloqueado', null, `Bloqueado até ${desbloqueiaEm}.`);
      return problema({ ...ERROS.LoginBloqueado, desbloqueia_em: desbloqueiaEm });
    }

    const tenants = usuario && usuario.senha !== null && usuario.senha === senha ? this.tenantsDe(usuario.id) : [];
    const inicial = tenants.find((t) => t.id === usuario?.ultimoTenant) ?? tenants[0];
    if (!usuario || !inicial) {
      this.falhas.set(chave, [...(this.falhas.get(chave) ?? []), agora]);
      auditar('login_falhou');
      return problema(ERROS.CredenciaisInvalidas);
    }

    this.falhas.delete(chave);
    const sessao: SessaoCookie = { usuarioId: usuario.id, tenantId: inicial.id, csrf: randomUUID() };
    this.sessoes.set(contexto, sessao);
    usuario.ultimoTenant = inicial.id;
    // Os dois cookies do login (contrato, SetCookieLogin), no host da API.
    const urlApi = new URL(requisicao.url()).origin;
    await contexto.addCookies([
      { name: COOKIE_SESSAO, value: randomUUID(), url: urlApi, httpOnly: true, sameSite: 'Lax' },
      { name: COOKIE_CSRF, value: sessao.csrf, url: urlApi, sameSite: 'Lax' },
    ]);
    auditar('login_ok', inicial.id);
    return json(200, this.corpoSessao({ usuario, tenantId: inicial.id, permissoes: new Set(), modo: 'cookie' }));
  }

  private async sair(quem: Autenticacao, contexto: BrowserContext): Promise<Resposta> {
    if (quem.modo !== 'cookie') return problema(ERROS.SemSessao);
    this.sessoes.delete(contexto);
    await contexto.clearCookies({ name: COOKIE_SESSAO });
    await contexto.clearCookies({ name: COOKIE_CSRF });
    this.auditar({ tipo: 'logout', email: quem.usuario.email, usuarioId: quem.usuario.id, tenantId: quem.tenantId });
    return vazio();
  }

  private trocarTenant(quem: Autenticacao, requisicao: Request, contexto: BrowserContext): Resposta {
    const sessao = this.sessoes.get(contexto);
    if (quem.modo !== 'cookie' || !sessao) return problema(ERROS.SemSessao);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const tenantId = corpo.tenant_id;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return problema(ERROS.DadosInvalidos);
    if (!this.tenantsDe(quem.usuario.id).some((t) => t.id === tenantId)) return problema(ERROS.SemAcessoAoTenant);
    sessao.tenantId = tenantId;
    quem.usuario.ultimoTenant = tenantId;
    this.auditar({ tipo: 'troca_tenant', email: quem.usuario.email, usuarioId: quem.usuario.id, tenantId });
    return json(200, this.corpoSessao({ ...quem, tenantId }));
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

  private corpoSessao({ usuario, tenantId, modo }: Autenticacao): Sessao {
    const tenants = modo === 'token' ? this.tenants.filter((t) => t.id === tenantId) : this.tenantsDe(usuario.id);
    const atual = tenants.find((t) => t.id === tenantId);
    const membro = this.membro(tenantId, usuario.id);
    if (!atual || !membro) throw new Error(`Sessão sem tenant: ${usuario.email}`);
    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      tenants: tenants.map(resumoTenant),
      tenant_atual: resumoTenant(atual),
      permissoes: [...this.permissoesDe(membro)].sort(),
    };
  }

  // --- Papéis --------------------------------------------------------------------------------------------------------

  private criarPapel(quem: Autenticacao, requisicao: Request): Resposta {
    const dados = lerDadosPapel(requisicao);
    if (ehResposta(dados)) return dados;
    if (this.papeisDe(quem.tenantId).some((p) => mesmoNome(p.nome, dados.nome))) return problema(ERROS.PapelExistente);
    const papel: Papel = { id: randomUUID(), tenantId: quem.tenantId, nome: dados.nome, permissoes: dados.permissoes, fixo: false };
    this.papeis.push(papel);
    this.auditarAtor(quem, 'papel_alterado', `Papel ${papel.nome} criado com: ${listaPermissoes(papel.permissoes)}.`);
    return json(201, this.corpoPapel(papel));
  }

  private obterPapel(quem: Autenticacao, id: string): Resposta {
    const papel = this.papeisDe(quem.tenantId).find((p) => p.id === id);
    return papel ? json(200, this.corpoPapel(papel)) : problema(ERROS.NaoEncontrado);
  }

  private alterarPapel(quem: Autenticacao, id: string, requisicao: Request): Resposta {
    const papel = this.papeisDe(quem.tenantId).find((p) => p.id === id);
    if (!papel) return problema(ERROS.NaoEncontrado);
    if (papel.fixo) return problema(ERROS.PapelFixo);
    const dados = lerDadosPapel(requisicao);
    if (ehResposta(dados)) return dados;
    if (this.papeisDe(quem.tenantId).some((p) => p.id !== id && mesmoNome(p.nome, dados.nome))) return problema(ERROS.PapelExistente);
    papel.nome = dados.nome;
    papel.permissoes = dados.permissoes;
    this.auditarAtor(quem, 'papel_alterado', `Papel ${papel.nome} alterado: ${listaPermissoes(papel.permissoes)}.`);
    return json(200, this.corpoPapel(papel));
  }

  private removerPapel(quem: Autenticacao, id: string): Resposta {
    const papel = this.papeisDe(quem.tenantId).find((p) => p.id === id);
    if (!papel) return problema(ERROS.NaoEncontrado);
    if (papel.fixo) return problema(ERROS.PapelFixo);
    if (this.membros.some((m) => m.papeis.has(id))) return problema(ERROS.PapelEmUso);
    this.papeis.splice(this.papeis.indexOf(papel), 1);
    this.auditarAtor(quem, 'papel_alterado', `Papel ${papel.nome} removido.`);
    return vazio();
  }

  private papeisDoTenant(tenantId: string): Esquemas['Papel'][] {
    return [...this.papeisDe(tenantId)].sort((a, b) => compararNomes(a.nome, b.nome)).map((papel) => this.corpoPapel(papel));
  }

  private corpoPapel(papel: Papel): Esquemas['Papel'] {
    return {
      id: papel.id,
      nome: papel.nome,
      permissoes: [...papel.permissoes].sort(),
      fixo: papel.fixo,
      total_usuarios: this.membros.filter((m) => m.papeis.has(papel.id)).length,
    };
  }

  // --- Usuários e link de redefinição --------------------------------------------------------------------------------

  private listarUsuarios(quem: Autenticacao, url: URL): Resposta {
    const fichas = this.membros
      .filter((m) => m.tenantId === quem.tenantId)
      .map((m) => this.corpoUsuario(m))
      .sort((a, b) => compararNomes(a.nome, b.nome) || a.id.localeCompare(b.id));
    return pagina(fichas, url);
  }

  private obterUsuario(quem: Autenticacao, id: string): Resposta {
    const membro = this.membro(quem.tenantId, id);
    return membro ? json(200, this.corpoUsuario(membro)) : problema(ERROS.NaoEncontrado);
  }

  /** `POST /v1/usuarios`: e-mail de outro tenant reaproveita o usuário (sem mudar o nome); do mesmo, 409. */
  private criarMembro(quem: Autenticacao, requisicao: Request): Resposta {
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const campos: Record<string, string> = {};
    const email = typeof corpo.email === 'string' ? corpo.email.trim() : '';
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (!EMAIL.test(email)) campos.email = 'Informe um e-mail válido.';
    if (nome === '') campos.nome = 'Informe o nome.';
    const papeis = listaDeTextos(corpo.papeis);
    if (papeis === undefined) campos.papeis = 'Informe uma lista de papéis.';
    if (Object.keys(campos).length > 0 || papeis === undefined) return problema({ ...ERROS.DadosInvalidos, campos });
    if (!papeis.every((id) => this.papeisDe(quem.tenantId).some((p) => p.id === id))) return problema(ERROS.PapelInexistente);

    const existente = this.usuarioPorEmail(email);
    if (existente && this.membro(quem.tenantId, existente.id)) return problema(ERROS.UsuarioExistente);
    const usuario = existente ?? this.criarUsuario(email, nome, null, null);
    const membro: Membro = { tenantId: quem.tenantId, usuarioId: usuario.id, papeis: new Set(papeis), ativo: true };
    this.membros.push(membro);
    this.auditarAtor(quem, 'usuario_alterado', `Usuário ${usuario.email} acrescentado com os papéis: ${this.nomesDosPapeis(membro)}.`);
    return json(201, this.corpoUsuario(membro));
  }

  /** `PUT /v1/usuarios/{id}`: nome, papéis e situação; o tenant não fica sem Admin ativo. */
  private alterarMembro(quem: Autenticacao, id: string, requisicao: Request): Resposta {
    const membro = this.membro(quem.tenantId, id);
    const usuario = this.usuario(id);
    if (!membro || !usuario) return problema(ERROS.NaoEncontrado);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const campos: Record<string, string> = {};
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (nome === '') campos.nome = 'Informe o nome.';
    const papeis = listaDeTextos(corpo.papeis);
    if (papeis === undefined) campos.papeis = 'Informe uma lista de papéis.';
    if (typeof corpo.ativo !== 'boolean') campos.ativo = 'Informe se o usuário está ativo.';
    if (Object.keys(campos).length > 0 || papeis === undefined || typeof corpo.ativo !== 'boolean') {
      return problema({ ...ERROS.DadosInvalidos, campos });
    }
    if (!papeis.every((p) => this.papeisDe(quem.tenantId).some((papel) => papel.id === p))) return problema(ERROS.PapelInexistente);
    const admin = this.papeisDe(quem.tenantId).find((p) => p.fixo);
    const continuaAdmin = corpo.ativo && admin !== undefined && papeis.includes(admin.id);
    const outroAdmin = this.membros.some(
      (m) => m.tenantId === quem.tenantId && m.usuarioId !== id && m.ativo && admin !== undefined && m.papeis.has(admin.id),
    );
    if (!continuaAdmin && !outroAdmin) return problema(ERROS.UltimoAdmin);

    usuario.nome = nome;
    membro.papeis = new Set(papeis);
    membro.ativo = corpo.ativo;
    if (!membro.ativo) {
      for (const [contexto, sessao] of this.sessoes) {
        if (sessao.usuarioId === id && sessao.tenantId === quem.tenantId) this.sessoes.delete(contexto);
      }
    }
    this.auditarAtor(quem, 'usuario_alterado', `Usuário ${usuario.email} alterado.`);
    return json(200, this.corpoUsuario(membro));
  }

  /** `POST /v1/usuarios/{id}/redefinicao`: link de uso único; um link novo invalida os anteriores do usuário. */
  private gerarLink(quem: Autenticacao, id: string): Resposta {
    const membro = this.membro(quem.tenantId, id);
    const alvo = this.usuario(id);
    if (!membro || !alvo) return problema(ERROS.NaoEncontrado);
    if (!membro.ativo) return problema(ERROS.UsuarioInativo);
    if (alvo.idExterno !== null) return problema(ERROS.UsuarioExterno);
    for (const link of this.links) if (link.usuarioId === id) link.usado = true;
    const link: LinkRedefinicao = {
      token: segredo(),
      usuarioId: id,
      tenantId: quem.tenantId,
      expiraEm: this.agora() + this.seguranca(quem.tenantId).validade_link_horas * 60 * 60 * 1000,
      usado: false,
    };
    this.links.push(link);
    this.auditarAtor(quem, 'redefinicao_gerada', `Link de redefinição para ${alvo.email} (${alvo.id}).`);
    return json(201, {
      link: `${this.urlCasca}/redefinir?token=${link.token}`,
      expira_em: new Date(link.expiraEm).toISOString(),
    } satisfies Esquemas['LinkRedefinicao']);
  }

  /** `POST /v1/redefinicao/verificacao` (pública): a maior senha mínima entre os tenants do usuário, sem usar o link. */
  private verificarLink(requisicao: Request): Resposta {
    if (!ehJson(requisicao)) return problema(ERROS.TipoConteudoInvalido);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    if (typeof corpo.token !== 'string') return problema(ERROS.DadosInvalidosToken);
    const link = this.linkValido(corpo.token);
    if (!link) return problema(ERROS.LinkInvalido);
    return json(200, {
      senha_minima: this.senhaMinimaDe(link.usuarioId),
      expira_em: new Date(link.expiraEm).toISOString(),
    } satisfies Esquemas['LinkVerificado']);
  }

  /** `POST /v1/redefinicao` (pública): troca a senha, usa o link e encerra as sessões do usuário. */
  private redefinirSenha(requisicao: Request): Resposta {
    if (!ehJson(requisicao)) return problema(ERROS.TipoConteudoInvalido);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    if (typeof corpo.token !== 'string') return problema(ERROS.DadosInvalidosToken);
    if (typeof corpo.nova_senha !== 'string') return problema(ERROS.DadosInvalidosNovaSenha);
    const link = this.linkValido(corpo.token);
    const usuario = link ? this.usuario(link.usuarioId) : undefined;
    if (!link || !usuario) return problema(ERROS.LinkInvalido);

    const minima = this.senhaMinimaDe(usuario.id);
    if (Array.from(corpo.nova_senha).length < minima) {
      return problema({ ...ERROS.SenhaInvalida, campos: { nova_senha: `A senha precisa ter pelo menos ${minima} caracteres.` } });
    }
    if (corpo.nova_senha.toLocaleLowerCase('en-US').includes(usuario.email.toLocaleLowerCase('en-US'))) {
      return problema({ ...ERROS.SenhaInvalida, campos: { nova_senha: 'A senha não pode conter o e-mail.' } });
    }
    usuario.senha = corpo.nova_senha;
    link.usado = true;
    for (const [contexto, sessao] of this.sessoes) if (sessao.usuarioId === usuario.id) this.sessoes.delete(contexto);
    this.auditar({ tipo: 'senha_redefinida', email: usuario.email, usuarioId: usuario.id, tenantId: link.tenantId });
    return vazio();
  }

  private linkValido(token: string): LinkRedefinicao | undefined {
    return this.links.find((link) => link.token === token && !link.usado && this.agora() < link.expiraEm);
  }

  private senhaMinimaDe(usuarioId: string): number {
    const minimas = this.tenantsDe(usuarioId).map((t) => this.seguranca(t.id).senha_minima);
    return Math.max(SEGURANCA.senha_minima.padrao, ...minimas);
  }

  private corpoUsuario(membro: Membro): Esquemas['Usuario'] {
    const usuario = this.usuario(membro.usuarioId);
    if (!usuario) throw new Error(`Membro sem usuário: ${membro.usuarioId}`);
    const papeis = this.papeisDe(membro.tenantId)
      .filter((p) => membro.papeis.has(p.id))
      .sort((a, b) => compararNomes(a.nome, b.nome))
      .map((p) => ({ id: p.id, nome: p.nome }));
    return { id: usuario.id, email: usuario.email, nome: usuario.nome, papeis, ativo: membro.ativo, externo: usuario.idExterno !== null };
  }

  private nomesDosPapeis(membro: Membro): string {
    const nomes = this.papeisDe(membro.tenantId)
      .filter((p) => membro.papeis.has(p.id))
      .map((p) => p.nome)
      .sort(compararNomes);
    return nomes.join(', ') || 'nenhum';
  }

  // --- Integração: chaves de API, domínios autorizados e incorporação ------------------------------------------------

  private listarChaves(quem: Autenticacao): Resposta {
    const itens = this.chaves
      .filter((c) => c.tenantId === quem.tenantId)
      .sort((a, b) => b.criadaEm - a.criadaEm)
      .map(
        (c): Esquemas['ChaveApi'] => ({
          id: c.id,
          nome: c.nome,
          prefixo: c.prefixo,
          criada_em: iso(c.criadaEm),
          ultimo_uso_em: c.ultimoUsoEm === null ? null : iso(c.ultimoUsoEm),
          revogada_em: c.revogadaEm === null ? null : iso(c.revogadaEm),
        }),
      );
    return json(200, { itens, proximo_cursor: null } satisfies Esquemas['ListaChavesApi']);
  }

  private criarChave(quem: Autenticacao, requisicao: Request): Resposta {
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (nome === '') return problema({ ...ERROS.DadosInvalidos, campos: { nome: 'Informe o nome.' } });
    const valor = `fc_${segredo()}`;
    const chave: Chave = {
      id: randomUUID(),
      tenantId: quem.tenantId,
      nome,
      prefixo: valor.slice(0, 11),
      chave: valor,
      criadaEm: this.agora(),
      ultimoUsoEm: null,
      revogadaEm: null,
    };
    this.chaves.push(chave);
    this.auditarAtor(quem, 'chave_api_criada', `Chave ${chave.prefixo} (${chave.nome}).`);
    return json(201, { id: chave.id, nome: chave.nome, prefixo: chave.prefixo, chave: chave.chave } satisfies Esquemas['ChaveApiCriada']);
  }

  /** Revogar uma chave já revogada também responde 204. */
  private revogarChave(quem: Autenticacao, id: string): Resposta {
    const chave = this.chaves.find((c) => c.id === id && c.tenantId === quem.tenantId);
    if (!chave) return problema(ERROS.NaoEncontrado);
    if (chave.revogadaEm === null) {
      chave.revogadaEm = this.agora();
      this.auditarAtor(quem, 'chave_api_revogada', `Chave ${chave.prefixo} (${chave.nome}).`);
    }
    return vazio();
  }

  private listarDominios(quem: Autenticacao): Resposta {
    const itens = this.dominios
      .filter((d) => d.tenantId === quem.tenantId)
      .sort((a, b) => b.criadoEm - a.criadoEm)
      .map((d): Esquemas['DominioAutorizado'] => ({ id: d.id, origem: d.origem, criado_em: iso(d.criadoEm) }));
    return json(200, { itens } satisfies Esquemas['ListaDominiosAutorizados']);
  }

  private criarDominio(quem: Autenticacao, requisicao: Request): Resposta {
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    if (typeof corpo.origem !== 'string') return problema(ERROS.DadosInvalidosOrigem);
    const origem = normalizarOrigem(corpo.origem);
    if (origem === undefined) return problema(ERROS.OrigemInvalida);
    if (this.dominios.some((d) => d.tenantId === quem.tenantId && d.origem === origem)) return problema(ERROS.DominioExistente);
    const dominio: Dominio = { id: randomUUID(), tenantId: quem.tenantId, origem, criadoEm: this.agora() };
    this.dominios.push(dominio);
    return json(201, { id: dominio.id, origem, criado_em: iso(dominio.criadoEm) } satisfies Esquemas['DominioAutorizado']);
  }

  private removerDominio(quem: Autenticacao, id: string): Resposta {
    const indice = this.dominios.findIndex((d) => d.id === id && d.tenantId === quem.tenantId);
    if (indice === -1) return problema(ERROS.NaoEncontrado);
    this.dominios.splice(indice, 1);
    return vazio();
  }

  /**
   * `POST /v1/incorporacao/sessoes` (`Authorization: Chave <chave>`): cria ou atualiza o usuário externo do
   * `id_externo` no tenant da chave, com os papéis pelos nomes (nunca o Admin), e devolve o token.
   */
  private emitirToken(requisicao: Request): Resposta {
    const autorizacao = requisicao.headers().authorization ?? '';
    const chave = autorizacao.startsWith('Chave ')
      ? this.chaves.find((c) => c.chave === autorizacao.slice('Chave '.length) && c.revogadaEm === null)
      : undefined;
    if (!chave) return problema(ERROS.ChaveInvalida);
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');
    const idExterno = texto(corpo.id_externo);
    const email = texto(corpo.email);
    const nome = texto(corpo.nome);
    const nomesPapeis = listaDeTextos(corpo.papeis);
    const campos: Record<string, string> = {};
    if (idExterno === '') campos.id_externo = 'Campo obrigatório.';
    if (email === '') campos.email = 'Campo obrigatório.';
    if (nome === '') campos.nome = 'Campo obrigatório.';
    if (nomesPapeis === undefined) campos.papeis = 'Informe uma lista de papéis.';
    if (Object.keys(campos).length > 0 || nomesPapeis === undefined) return problema({ ...ERROS.DadosInvalidos, campos });

    const doTenant = this.papeisDe(chave.tenantId);
    if (nomesPapeis.some((n) => doTenant.some((p) => p.fixo && mesmoNome(p.nome, n)))) return problema(ERROS.PapelNaoPermitido);
    const papeis = nomesPapeis.map((n) => doTenant.find((p) => mesmoNome(p.nome, n)));
    if (papeis.some((p) => p === undefined)) return problema(ERROS.PapelInexistente);

    let usuario = this.usuarios.find((u) => u.idExterno === `${chave.tenantId}:${idExterno}`);
    const dono = this.usuarioPorEmail(email);
    if (dono && dono !== usuario) return problema(ERROS.EmailEmUso);
    usuario ??= this.criarUsuario(email, nome, null, `${chave.tenantId}:${idExterno}`);
    usuario.email = email;
    usuario.nome = nome;
    let membro = this.membro(chave.tenantId, usuario.id);
    if (membro && !membro.ativo) return problema(ERROS.UsuarioInativoIncorporacao);
    const admin = doTenant.find((p) => p.fixo);
    const ids = new Set(papeis.map((p) => p?.id ?? ''));
    if (membro && admin && membro.papeis.has(admin.id)) ids.add(admin.id);
    if (membro) membro.papeis = ids;
    else {
      membro = { tenantId: chave.tenantId, usuarioId: usuario.id, papeis: ids, ativo: true };
      this.membros.push(membro);
    }

    const agora = this.agora();
    const token = segredo();
    const expiraEm = agora + this.seguranca(chave.tenantId).validade_token_minutos * 60 * 1000;
    this.tokens.set(token, { usuarioId: usuario.id, tenantId: chave.tenantId, expiraEm });
    chave.ultimoUsoEm = agora;
    this.auditar({
      tipo: 'token_incorporacao_emitido',
      email,
      usuarioId: usuario.id,
      tenantId: chave.tenantId,
      detalhe: `Chave ${chave.prefixo}; id externo ${idExterno}.`,
    });
    return json(201, { token, expira_em: iso(expiraEm) } satisfies Esquemas['TokenIncorporacao']);
  }

  // --- Auditoria de acessos ------------------------------------------------------------------------------------------

  /**
   * `GET /v1/auditoria/acessos`: os eventos do tenant e os sem tenant (falha e bloqueio de login) de um membro dele,
   * do mais recente ao mais antigo, com os filtros `tipo` (repetido), `desde` (inclusivo) e `ate` (exclusivo).
   */
  private listarAcessos(quem: Autenticacao, url: URL): Resposta {
    const tipos = url.searchParams.getAll('tipo');
    const desconhecido = tipos.find((tipo) => !(TIPOS_EVENTO as readonly string[]).includes(tipo));
    if (desconhecido !== undefined) {
      return problema({ ...ERROS.TipoEventoInvalido, campos: { tipo: `Tipo desconhecido: '${desconhecido}'.` } });
    }
    const desde = instante(url.searchParams.get('desde'));
    const ate = instante(url.searchParams.get('ate'));
    if (desde === null || ate === null) return problema(ERROS.DadosInvalidos);
    if (desde !== undefined && ate !== undefined && desde > ate) {
      return problema({ ...ERROS.DadosInvalidos, campos: { ate: 'Informe um fim depois do início.' } });
    }
    const eventos = this.eventos
      .filter(
        (e) =>
          e.tenantId === quem.tenantId ||
          (e.tenantId === null && e.usuarioId !== null && this.membro(quem.tenantId, e.usuarioId) !== undefined),
      )
      .filter((e) => tipos.length === 0 || tipos.includes(e.tipo))
      .filter((e) => (desde === undefined || e.ocorridoEm >= desde) && (ate === undefined || e.ocorridoEm < ate))
      .sort((a, b) => b.ocorridoEm - a.ocorridoEm || b.ordem - a.ordem)
      .map(
        (e): Esquemas['EventoAcesso'] => ({
          id: e.id,
          ocorrido_em: iso(e.ocorridoEm),
          tipo: e.tipo,
          usuario_id: e.usuarioId,
          email_informado: e.email,
          ip: IP,
          detalhe: e.detalhe,
        }),
      );
    return pagina(eventos, url);
  }

  private auditar(evento: { tipo: TipoEvento; email: string; usuarioId: string | null; tenantId: string | null; detalhe?: string | null }) {
    this.eventos.push({ id: randomUUID(), ordem: this.eventos.length, ocorridoEm: this.agora(), detalhe: null, ...evento });
  }

  /** Evento de quem fez a mudança (o Admin), como o back grava as mudanças de acesso. */
  private auditarAtor(quem: Autenticacao, tipo: TipoEvento, detalhe: string) {
    this.auditar({ tipo, email: quem.usuario.email, usuarioId: quem.usuario.id, tenantId: quem.tenantId, detalhe });
  }

  // --- Configuração de segurança -------------------------------------------------------------------------------------

  private corpoSeguranca(tenantId: string): Esquemas['ConfiguracaoSeguranca'] {
    const valores = this.seguranca(tenantId);
    return Object.fromEntries(
      CAMPOS_SEGURANCA.map((campo) => [campo, { valor: valores[campo], ...SEGURANCA[campo] }]),
    ) as Esquemas['ConfiguracaoSeguranca'];
  }

  /** `PUT /v1/configuracoes/seguranca`: os cinco inteiros; fora dos limites, 422 com todos os campos e nada gravado. */
  private alterarSeguranca(quem: Autenticacao, requisicao: Request): Resposta {
    const corpo = lerJson(requisicao);
    if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
    const tipos: Record<string, string> = {};
    const foraDoLimite: Record<string, string> = {};
    const novos = { ...this.seguranca(quem.tenantId) };
    for (const campo of CAMPOS_SEGURANCA) {
      const valor = corpo[campo];
      if (typeof valor !== 'number' || !Number.isInteger(valor)) tipos[campo] = 'Informe um número inteiro.';
      else if (valor < SEGURANCA[campo].minimo || valor > SEGURANCA[campo].maximo) {
        foraDoLimite[campo] = `Informe um valor de ${SEGURANCA[campo].minimo} a ${SEGURANCA[campo].maximo}.`;
      } else novos[campo] = valor;
    }
    if (Object.keys(tipos).length > 0) return problema({ ...ERROS.DadosInvalidosSeguranca, campos: tipos });
    if (Object.keys(foraDoLimite).length > 0) return problema({ ...ERROS.ValorForaDoLimite, campos: foraDoLimite });

    const tenant = this.tenants.find((t) => t.id === quem.tenantId);
    if (!tenant) throw new Error(`Tenant desconhecido: ${quem.tenantId}`);
    // Como o back: `campo: antigo → novo` de cada campo que mudou, e nada é auditado se nada mudou.
    const mudancas = CAMPOS_SEGURANCA.filter((campo) => novos[campo] !== tenant.seguranca[campo]).map(
      (campo) => `${campo}: ${tenant.seguranca[campo]} → ${novos[campo]}`,
    );
    if (mudancas.length > 0) {
      tenant.seguranca = novos;
      this.auditarAtor(quem, 'seguranca_alterada', `${mudancas.join('; ')}.`);
    }
    return json(200, this.corpoSeguranca(quem.tenantId));
  }

  private seguranca(tenantId: string): Record<CampoSeguranca, number> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error(`Tenant desconhecido: ${tenantId}`);
    return tenant.seguranca;
  }

  // --- Dados ---------------------------------------------------------------------------------------------------------

  private criarTenant(nome: string): Tenant {
    const tenant: Tenant = {
      id: randomUUID(),
      nome,
      seguranca: Object.fromEntries(CAMPOS_SEGURANCA.map((campo) => [campo, SEGURANCA[campo].padrao])) as Record<CampoSeguranca, number>,
    };
    this.tenants.push(tenant);
    for (const [nomePapel, permissoes] of Object.entries(PAPEIS_INICIAIS)) {
      this.papeis.push({ id: randomUUID(), tenantId: tenant.id, nome: nomePapel, permissoes: [...permissoes], fixo: nomePapel === ADMIN });
    }
    return tenant;
  }

  private criarUsuario(email: string, nome: string, senha: string | null, idExterno: string | null): Usuario {
    const usuario: Usuario = { id: randomUUID(), email, nome, senha, idExterno, ultimoTenant: null };
    this.usuarios.push(usuario);
    return usuario;
  }

  private usuario(id: string): Usuario | undefined {
    return this.usuarios.find((u) => u.id === id);
  }

  private usuarioPorEmail(email: string): Usuario | undefined {
    const chave = email.trim().toLocaleLowerCase('en-US');
    return this.usuarios.find((u) => u.email.toLocaleLowerCase('en-US') === chave);
  }

  private membro(tenantId: string, usuarioId: string): Membro | undefined {
    return this.membros.find((m) => m.tenantId === tenantId && m.usuarioId === usuarioId);
  }

  /** Os tenants em que o usuário está ativo, por nome. */
  private tenantsDe(usuarioId: string): Tenant[] {
    return this.tenants
      .filter((t) => this.membro(t.id, usuarioId)?.ativo === true)
      .sort((a, b) => compararNomes(a.nome, b.nome));
  }

  private papeisDe(tenantId: string): Papel[] {
    return this.papeis.filter((p) => p.tenantId === tenantId);
  }

  private permissoesDe(membro: Membro): Set<string> {
    const permissoes = new Set<string>();
    for (const papel of this.papeisDe(membro.tenantId)) {
      if (membro.papeis.has(papel.id)) for (const codigo of papel.permissoes) permissoes.add(codigo);
    }
    return permissoes;
  }
}

const ROTAS_AUTENTICADAS = new Set([
  'GET /v1/sessao',
  'DELETE /v1/sessao',
  'PUT /v1/sessao/tenant',
  'GET /v1/permissoes',
  'GET /v1/papeis',
  'POST /v1/papeis',
  'GET /v1/papeis/{id}',
  'PUT /v1/papeis/{id}',
  'DELETE /v1/papeis/{id}',
  'GET /v1/usuarios',
  'POST /v1/usuarios',
  'GET /v1/usuarios/{id}',
  'PUT /v1/usuarios/{id}',
  'POST /v1/usuarios/{id}/redefinicao',
  'GET /v1/chaves-api',
  'POST /v1/chaves-api',
  'DELETE /v1/chaves-api/{id}',
  'GET /v1/dominios-autorizados',
  'POST /v1/dominios-autorizados',
  'DELETE /v1/dominios-autorizados/{id}',
  'GET /v1/auditoria/acessos',
  'GET /v1/configuracoes/seguranca',
  'PUT /v1/configuracoes/seguranca',
]);

/** `403 sem_permissao` se quem chama não tem nenhuma das permissões (requisitos alternativos do contrato). */
function exigir(quem: Autenticacao, codigos: readonly CodigoPermissao[]): Resposta | undefined {
  return codigos.some((codigo) => quem.permissoes.has(codigo)) ? undefined : problema(ERROS.SemPermissao);
}

/** Nome e permissões de `POST` e `PUT /v1/papeis`, ou o 422. */
function lerDadosPapel(requisicao: Request): { nome: string; permissoes: CodigoPermissao[] } | Resposta {
  const corpo = lerJson(requisicao);
  if (corpo === undefined) return problema(ERROS.DadosInvalidosJsonMalformado);
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  const permissoes = Array.isArray(corpo.permissoes) ? corpo.permissoes : undefined;
  const campos: Record<string, string> = {};
  if (nome === '') campos.nome = 'Informe o nome do papel.';
  if (!permissoes || !permissoes.every((p) => typeof p === 'string' && (CODIGOS as readonly string[]).includes(p))) {
    campos.permissoes = 'Informe permissões do catálogo.';
  }
  if (Object.keys(campos).length > 0 || !permissoes) return problema({ ...ERROS.DadosInvalidos, campos });
  return { nome, permissoes: [...new Set(permissoes as CodigoPermissao[])] };
}

function listaDeTextos(valor: unknown): string[] | undefined {
  return Array.isArray(valor) && valor.every((id) => typeof id === 'string') ? [...new Set(valor as string[])] : undefined;
}

/** `https?://host[:porta]` em minúsculas, sem barra final e sem a porta padrão; `undefined` fora do formato. */
function normalizarOrigem(valor: string): string | undefined {
  const origem = valor.trim();
  if (!/^https?:\/\/[^\s/?#@]+\/?$/i.test(origem)) return undefined;
  try {
    const url = new URL(origem);
    return url.hostname === '' ? undefined : url.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Uma página de `{itens, proximo_cursor}` pelo `limite` (1 a 200, padrão 50) e pelo `cursor` (a posição, em texto). */
function pagina<T>(itens: readonly T[], url: URL): Resposta {
  const textoLimite = url.searchParams.get('limite');
  const limite = textoLimite === null ? LIMITE_PADRAO : Number(textoLimite);
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) return problema(ERROS.DadosInvalidosLimite);
  const cursor = url.searchParams.get('cursor');
  const inicio = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(inicio) || inicio < 0 || inicio > itens.length) return problema(ERROS.CursorInvalido);
  const fim = inicio + limite;
  return json(200, { itens: itens.slice(inicio, fim), proximo_cursor: fim < itens.length ? String(fim) : null });
}

/** Um instante ISO 8601 da consulta: `undefined` se ausente, `null` se malformado. */
function instante(valor: string | null): number | undefined | null {
  if (valor === null || valor === '') return undefined;
  const quando = Date.parse(valor);
  return Number.isNaN(quando) ? null : quando;
}

function resumoTenant(tenant: Tenant): Esquemas['TenantResumo'] {
  return { id: tenant.id, nome: tenant.nome };
}

function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/** Nomes únicos no tenant, sem diferenciar maiúsculas nem os espaços das pontas. */
function mesmoNome(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function listaPermissoes(permissoes: readonly string[]): string {
  return [...permissoes].sort().join(', ') || 'nenhuma';
}

function segredo(): string {
  return randomBytes(24).toString('base64url');
}

function iso(instanteMs: number): string {
  return new Date(instanteMs).toISOString();
}

function json(status: number, corpo: unknown): Resposta {
  return { status, tipo: 'application/json', corpo };
}

function vazio(): Resposta {
  return { status: 204, tipo: 'application/json', corpo: undefined };
}

function problema(exemplo: CorpoErro): Resposta {
  return { status: exemplo.status, tipo: 'application/problem+json', corpo: exemplo };
}

function ehResposta(valor: object): valor is Resposta {
  return 'corpo' in valor && 'status' in valor;
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
