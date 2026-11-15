// Respostas da API simulada, tiradas do contrato do backend (../backend/contratos/openapi.yaml).
//
// O CI do front não tem o repositório do backend ao lado, então os exemplos ficam copiados aqui, tipados pelos
// esquemas gerados do contrato (ADR 0005). O teste `exemplos-contrato.spec.ts` compara esta cópia com o
// `components.examples` do contrato sempre que ele está ao lado (máquina de desenvolvimento): divergiu, reprova.
import type { components } from '../../packages/react/src/api/gerado/esquema';

export type Esquemas = components['schemas'];
export type Sessao = Esquemas['Sessao'];
export type Problema = Esquemas['Problema'];
/** Um corpo de erro do contrato: o `Problema` ou um dos esquemas planos com membros próprios. */
export type CorpoErro = Problema | Esquemas['ProblemaLoginBloqueado'] | Esquemas['ProblemaDadosInvalidos'];

/** Cópia literal de `components.examples` do contrato (nome do exemplo → `value`). */
export const EXEMPLOS = {
  SemSessao: {
    type: 'about:blank',
    title: 'Sem sessão',
    status: 401,
    detail: 'Sua sessão expirou. Entre novamente.',
    codigo: 'sem_sessao',
  },
  CsrfInvalido: {
    type: 'about:blank',
    title: 'Requisição recusada',
    status: 403,
    detail: 'Não foi possível confirmar a origem da requisição. Recarregue a página e tente de novo.',
    codigo: 'csrf_invalido',
  },
  SemAcessoAoTenant: {
    type: 'about:blank',
    title: 'Sem acesso ao tenant',
    status: 403,
    detail: 'Você não tem acesso a esta empresa.',
    codigo: 'sem_acesso_ao_tenant',
  },
  CredenciaisInvalidas: {
    type: 'about:blank',
    title: 'Credenciais inválidas',
    status: 401,
    detail: 'E-mail ou senha incorretos.',
    codigo: 'credenciais_invalidas',
  },
  LoginBloqueado: {
    type: 'about:blank',
    title: 'Login bloqueado',
    status: 423,
    detail: 'Muitas tentativas erradas. Tente de novo mais tarde.',
    codigo: 'login_bloqueado',
    desbloqueia_em: '2026-11-15T14:30:00Z',
  } satisfies Esquemas['ProblemaLoginBloqueado'],
  DadosInvalidos: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    codigo: 'dados_invalidos',
    campos: { tenant_id: 'Informe um identificador válido.' },
  } satisfies Esquemas['ProblemaDadosInvalidos'],
  DadosInvalidosJsonMalformado: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    codigo: 'dados_invalidos',
    campos: { corpo: 'Não foi possível ler os dados enviados.' },
  } satisfies Esquemas['ProblemaDadosInvalidos'],
  TipoConteudoInvalido: {
    type: 'about:blank',
    title: 'Tipo de conteúdo inválido',
    status: 415,
    detail: 'Não foi possível processar a requisição. Recarregue a página e tente de novo.',
    codigo: 'tipo_conteudo_invalido',
  },
  MuitasTentativas: {
    type: 'about:blank',
    title: 'Muitas tentativas',
    status: 429,
    detail: 'Muitas tentativas de login a partir deste endereço. Aguarde um minuto e tente de novo.',
    codigo: 'muitas_tentativas',
  },
} satisfies Record<string, CorpoErro>;

export type NomeExemplo = keyof typeof EXEMPLOS;
