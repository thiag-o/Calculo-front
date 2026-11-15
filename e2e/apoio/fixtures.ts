// Fixture dos testes ponta a ponta: os mesmos arquivos de teste rodam nos dois projetos do playwright.config.ts.
// - simulado (pnpm e2e): a API simulada (`ApiSimulada`) é ligada em toda página, com as contas abaixo;
// - real (pnpm e2e:real): o casca fala com o back de verdade em E2E_API_URL, com as contas do `preparar-local`.
import { randomUUID } from 'node:crypto';
import { test as base, expect, type TestInfo } from '@playwright/test';
import { ApiSimulada, type ContaSimulada } from './api-simulada';

export { expect };

export type ModoE2E = 'simulado' | 'real';

/** Contas que os testes usam. `admin`: um tenant só. `doisTenants`: pertence a dois tenants. */
export type NomeConta = 'admin' | 'doisTenants';

export interface Credenciais {
  email: string;
  senha: string;
}

export interface ApiE2E {
  modo: ModoE2E;
  /** Endereço da API (sem o `/v1`) no modo real; `undefined` no simulado. */
  apiUrl: string | undefined;
  /** E-mail e senha de uma conta. No modo real, vêm das variáveis E2E_* (veja `CONTAS_REAIS`). */
  conta(nome: NomeConta): Credenciais;
  /** Um e-mail sem conta, novo a cada chamada: bloqueá-lo não atrapalha outro teste nem a próxima rodada. */
  emailSemConta(): string;
}

// Contas da simulação, no formato do `preparar-local` do back (tenants "Demonstração" e "Outra Empresa").
const DEMONSTRACAO = { id: '7d0c1f6e-0000-4000-8000-000000000001', nome: 'Demonstração' };
const OUTRA_EMPRESA = { id: '7d0c1f6e-0000-4000-8000-000000000002', nome: 'Outra Empresa' };

const CONTAS_SIMULADAS: Record<NomeConta, ContaSimulada> = {
  admin: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a1',
    email: 'admin@demo.local',
    senha: 'senha-simulada-admin',
    nome: 'Administradora Demonstração',
    tenants: [{ tenant: DEMONSTRACAO, permissoes: ['usuarios.gerenciar', 'workflows.ver', 'auditoria.ver'] }],
  },
  doisTenants: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a2',
    email: 'dois.tenants@demo.local',
    senha: 'senha-simulada-dois-tenants',
    nome: 'Usuário de Dois Tenants',
    tenants: [
      { tenant: OUTRA_EMPRESA, permissoes: ['workflows.ver'] },
      { tenant: DEMONSTRACAO, permissoes: ['workflows.ver', 'execucoes.ver'] },
    ],
  },
};

/**
 * Variáveis das contas do modo real (as credenciais que o `preparar-local` do back imprime e documenta em
 * `../backend/docs/ambientes.md`). O e-mail do Admin tem o padrão do plano do back; as senhas são obrigatórias.
 */
const CONTAS_REAIS: Record<NomeConta, { email: string; senha: string; padraoEmail?: string }> = {
  admin: { email: 'E2E_ADMIN_EMAIL', senha: 'E2E_ADMIN_SENHA', padraoEmail: 'admin@demo.local' },
  doisTenants: { email: 'E2E_DOIS_TENANTS_EMAIL', senha: 'E2E_DOIS_TENANTS_SENHA' },
};

const AJUDA_CONTAS = 'credenciais do preparar-local do back, em ../backend/docs/ambientes.md';

function variavel(nome: string, ajuda: string, padrao?: string): string {
  const valor = process.env[nome]?.trim() || padrao;
  if (!valor) throw new Error(`Modo real: defina ${nome} (${ajuda}).`);
  return valor;
}

export function modoDoProjeto(testInfo: TestInfo): ModoE2E {
  const modo: unknown = testInfo.project.metadata?.modo;
  if (modo !== 'simulado' && modo !== 'real') {
    throw new Error(`Projeto "${testInfo.project.name}" sem metadata.modo 'simulado' ou 'real' no playwright.config.ts.`);
  }
  return modo;
}

function apiUrlReal(): string {
  return variavel('E2E_API_URL', 'endereço da API do back, sem o /v1, o mesmo do VITE_API_URL do casca').replace(/\/+$/, '');
}

function emailSemConta(): string {
  return `e2e-sem-conta-${randomUUID()}@e2e.local`;
}

export const test = base.extend<{ api: ApiE2E }>({
  api: [
    async ({ page, baseURL }, use, testInfo) => {
      const modo = modoDoProjeto(testInfo);
      const origemCasca = new URL(baseURL ?? 'http://localhost:5173').origin;

      if (modo === 'simulado') {
        const simulada = new ApiSimulada(Object.values(CONTAS_SIMULADAS));
        await simulada.instalar(page, origemCasca);
        await use({
          modo,
          apiUrl: undefined,
          conta: (nome) => ({ email: CONTAS_SIMULADAS[nome].email, senha: CONTAS_SIMULADAS[nome].senha }),
          emailSemConta,
        });
        if (simulada.naoPrevistas.length > 0) {
          throw new Error(`O casca chamou rotas fora da API simulada: ${simulada.naoPrevistas.join(', ')}.`);
        }
        return;
      }

      // Modo real: o casca precisa estar apontado (VITE_API_URL) para a mesma API de E2E_API_URL.
      const apiUrl = apiUrlReal();
      const origemApi = new URL(apiUrl).origin;
      const outrasOrigens = new Set<string>();
      page.on('request', (requisicao) => {
        const url = new URL(requisicao.url());
        if (url.pathname.startsWith('/v1/') && url.origin !== origemCasca && url.origin !== origemApi) {
          outrasOrigens.add(url.origin);
        }
      });
      await use({
        modo,
        apiUrl,
        conta: (nome) => {
          const nomes = CONTAS_REAIS[nome];
          return { email: variavel(nomes.email, AJUDA_CONTAS, nomes.padraoEmail), senha: variavel(nomes.senha, AJUDA_CONTAS) };
        },
        emailSemConta,
      });
      if (outrasOrigens.size > 0) {
        throw new Error(
          `O casca chamou a API em ${[...outrasOrigens].join(', ')}, mas E2E_API_URL é ${origemApi}. ` +
            'Suba o casca com VITE_API_URL igual a E2E_API_URL.',
        );
      }
    },
    { auto: true },
  ],
});
