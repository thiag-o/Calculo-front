// Fixture dos testes ponta a ponta do épico 2, sobre a do épico 1 (e2e/apoio/fixtures.ts): os mesmos arquivos rodam
// nos dois projetos do playwright.config.ts.
// - simulado (pnpm e2e): a API simulada do épico 2 (`SimulacaoEpico2`) responde a toda chamada a `/v1/...`, em todas as
//   páginas do teste, com um estado só (o Admin cria um usuário numa página e a pessoa entra em outra);
// - real (pnpm e2e:real): o casca fala com o back de verdade, com as contas do `preparar-local`.
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, test as base, type ApiE2E } from '../../apoio/fixtures';
import { SimulacaoEpico2, type ContaInicial } from './simulacao';

export { expect };

export interface Epico2 {
  /**
   * A origem do "hospedeiro" (`http://localhost:5274`): a da página de teste de incorporação, que o
   * `playwright.config.ts` sobe ao lado do casca, nos dois modos. É o domínio que o `preparar-local` do back cadastra.
   */
  origemHospedeiro: string;
  /**
   * Uma página num navegador novo (outro contexto, sem os cookies da página do teste), para outra pessoa: quem recebe
   * o link de redefinição, o sistema hospedeiro. No modo simulado, com a mesma API simulada.
   */
  novaPagina(): Promise<Page>;
}

/**
 * As contas que já existem no back, como o `preparar-local` as cria (tenants "Demonstração" e "Outra Empresa"). Admin e
 * dois tenants usam as credenciais da fixture do épico 1; o Configurador só existe para a lista de usuários ser realista.
 */
function contasIniciais(api: ApiE2E): ContaInicial[] {
  return [
    { ...api.conta('admin'), nome: 'Administradora Demonstração', papeis: { Demonstração: 'Admin' } },
    {
      email: 'configurador@demo.local',
      senha: 'senha-simulada-configurador',
      nome: 'Configurador Demonstração',
      papeis: { Demonstração: 'Configurador' },
    },
    {
      ...api.conta('doisTenants'),
      nome: 'Usuário de Dois Tenants',
      papeis: { Demonstração: 'Operador', 'Outra Empresa': 'Admin' },
    },
  ];
}

/** A origem do hospedeiro, do `metadata.hospedeiroUrl` do `playwright.config.ts`. */
function origemHospedeiro(testInfo: TestInfo): string {
  const url: unknown = testInfo.config.metadata?.hospedeiroUrl;
  if (typeof url !== 'string') throw new Error('Defina metadata.hospedeiroUrl no playwright.config.ts.');
  return new URL(url).origin;
}

export const test = base.extend<{ epico2: Epico2 }>({
  epico2: [
    // Depende de `api`: a rota da simulação do épico 2 entra depois da do épico 1 e, por isso, responde antes dela.
    async ({ page, api, browser, baseURL }, use, testInfo) => {
      const origemCasca = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulacao = api.modo === 'simulado' ? new SimulacaoEpico2(contasIniciais(api), origemCasca) : null;
      if (simulacao) await simulacao.instalar(page);

      const contextos: BrowserContext[] = [];
      await use({
        origemHospedeiro: origemHospedeiro(testInfo),
        async novaPagina() {
          const contexto = await browser.newContext({ baseURL });
          contextos.push(contexto);
          const nova = await contexto.newPage();
          if (simulacao) await simulacao.instalar(nova);
          return nova;
        },
      });
      await Promise.all(contextos.map((contexto) => contexto.close()));

      if (simulacao && simulacao.naoPrevistas.length > 0) {
        throw new Error(`O módulo chamou rotas fora da API simulada: ${simulacao.naoPrevistas.join(', ')}.`);
      }
    },
    { auto: true },
  ],
});
