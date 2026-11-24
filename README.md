# Fluxo de Cálculo · frontend

Repositório do front: o pacote **`@fluxo/react`**, que é o produto incorporável, e o **app casca**, o app próprio que usa esse pacote (o "hospedeiro zero").
O backend fica num repositório separado (`../backend`). O desenho do produto está em `../docs/design.md`, fora deste repositório.

> **Estado atual: só scaffold.** Ainda não há código de produto nem dependências instaladas; isso começa na fase 1 (Fundação).

Para incorporar o módulo num sistema hospedeiro, veja o [guia de incorporação](docs/incorporacao.md).

**Código em inglês** (ADR [0031](docs/adr/0031-codigo-em-ingles.md)): pastas, arquivos, identificadores, comentários, classes `fc-`, rotas da URL e scripts ficam em inglês; textos para pessoas (rótulos, mensagens, descrições de teste) e a documentação ficam em pt-BR. Os nomes estão no [glossário do front](docs/glossario.md) e, para a API, no `../backend/docs/glossario.md`.

## Estrutura

```
frontend/
├── packages/react/   @fluxo/react: o produto, organizado por verticais (ADR 0003); exporta <FluxoCalculo> e as telas avulsas <Home>, <Catalog>, <Workflows>, <Executions>, <Audit> e <Admin>
├── apps/shell/       app casca (próprio): login + layout, usando o pacote (ADR 0002)
├── docs/
│   ├── ambientes.md  local, homologação, produção e variáveis
│   ├── incorporacao.md  guia para quem incorpora o @fluxo/react
│   ├── glossario.md  nomes do código do front (português → inglês)
│   └── adr/          decisões de arquitetura (índice em docs/adr/README.md)
├── .changeset/       versões do pacote (Changesets)
└── .github/workflows ci.yml · publicar.yml · deploy-casca.yml (desligado)
```

## Telas e rotas do módulo

`<FluxoCalculo>` monta estas telas (menu lateral no casca, abas no modo incorporado); cada item aparece só com a permissão dele. No modo `url`, as rotas internas são:

| Tela | Rotas | Permissão |
|---|---|---|
| Início | `/home` | todos |
| Catálogo | `/catalog`, `/catalog/<aba>/:id` | `connections.view` |
| Workflows | `/workflows`, `/workflows/:id`, `/workflows/:id/executions`, `/workflows/:id/editor` | `workflows.view` |
| Execuções | `/executions`, `/executions/:id` | `executions.view` |
| Auditoria | `/audit` | `audit.view` |
| Administração | `/admin/<área>` | uma permissão por área |

- **Executar lote** fica no cabeçalho do editor, na Visão geral e na lista de execuções do workflow, só com `executions.trigger`; ao disparar, abre o painel da execução nova (sem `executions.view`, a pessoa fica onde está, com o aviso de que o lote foi criado, e `/workflows/:id/executions` cai na Visão geral). O Aprovador e o Auditor não têm o botão nem o "Cancelar execução".
- O menu do workflow (com um workflow aberto) tem Visão geral e Execuções.
- O trace de um registro, no painel da execução (com `traces.view`), é o mesmo componente do "Calcular" do editor; o módulo o entrega ao painel (as verticais `executions` e `editor` não se importam).
- A prop `screen` aceita `'executions'`. Avulsas, cada uma funcionando sozinha: `<Executions>` (lista e painel, pede `executions.view`) e `<Workflows>` (lista, Visão geral, editor e execuções, com "Executar lote" e "Ver execuções" pelas permissões do papel).

## Ferramentas

| O quê | Versão |
|---|---|
| Node | 26 (`.nvmrc`; mudança de 24 para 26 vinda da resposta G6 do dono do produto) |
| pnpm | 10 (workspaces: `pnpm-workspace.yaml`) |
| Registro do pacote | GitHub Packages (`.npmrc`) |

## Começar (a partir da fase 1)

1. Crie um token pessoal do GitHub com `read:packages` e exporte como `NODE_AUTH_TOKEN`.
2. Copie `apps/shell/.env.example` para `apps/shell/.env`.
3. Suba o backend (veja `../backend/README.md`).
4. Instale e rode:

```bash
pnpm install
```

```bash
pnpm dev
```

### Dependências previstas (instaladas na fase 1)

- **`@fluxo/react`:** `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `react-hook-form`, `zod`, Radix (portais dentro da raiz do módulo).
- **Desenvolvimento:** `typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-dts`, `vitest`, `@testing-library/react`, `eslint`, `typescript-eslint`, `eslint-plugin-boundaries`, `@changesets/cli`, gerador de tipos do OpenAPI (ADR 0005).

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Roda o app casca em `http://localhost:5173` |
| `pnpm build` | Compila o pacote e o casca |
| `pnpm lint` | Busca de caractere NUL e de controle nos arquivos versionados (`scripts/check-control-chars.mjs`), depois ESLint com as fronteiras entre verticais |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm test` | Testes (Vitest) |
| `pnpm changeset` | Registra uma mudança do pacote para a próxima versão |
| `pnpm generate:api` | Gera os tipos da API a partir do OpenAPI do backend (ADR 0005), em `packages/react/src/api/generated/` |
| `pnpm e2e` | Testes ponta a ponta (Playwright) contra a API **simulada** (no épico 5, com a campanha de referência: catálogo, prévia e Calcular por registro, em `e2e/epic-5/support/`) |
| `pnpm e2e:real` | Os mesmos testes contra o back de verdade (veja abaixo) |
| `pnpm e2e:visual` | Prova visual das telas dos épicos 1 a 4, nos dois temas e em 1440, 1180 e 900 px, contra a API simulada (veja abaixo) |

## Testes em paralelo (worktrees)

Várias worktrees podem rodar o `pnpm e2e` (simulado) ao mesmo tempo. Defina `FLUXO_TEST_ISOLATION_ID` com um id próprio da worktree (por exemplo, o da tarefa):

```bash
FLUXO_TEST_ISOLATION_ID=F62 pnpm e2e
```

No PowerShell: `$env:FLUXO_TEST_ISOLATION_ID='F62'; pnpm e2e`.

- Numa worktree (`worktrees/frontend/<T>`), o `../backend` não existe. Defina também `FLUXO_BACKEND_DIR=C:/dev/fluxo-calculo/backend`: o `pnpm generate:api` e o `e2e/support/contract-examples.spec.ts` leem o contrato de `$FLUXO_BACKEND_DIR/contracts/openapi.yaml`. Com a variável definida e o contrato ausente, os dois falham com mensagem clara. Sem a variável, vale o `../backend`; se ele não existir (o CI do front), o teste é pulado com o motivo na saída e o `generate:api` falha.

- Com a variável, o casca e a página de incorporação sobem em portas próprias, derivadas do id de forma determinística (hash do id), numa faixa fixa de 6100 a 6999: o casca na porta par e a página de incorporação na ímpar seguinte. As portas 5000 e 5001 nunca entram (regra do dono). A conta está em `scripts/e2e-ports.mjs` e é conferida por `e2e/support/e2e-ports.spec.ts`.
- Com a variável, também a pasta de artefatos do Playwright (`test-results/<id>`) e o build do casca para o e2e (`node_modules/.cache/e2e-shell-<id>`) levam o id, então duas execuções no mesmo checkout não dividem nem apagam os arquivos uma da outra.
- Sem a variável, ficam as portas de sempre: 5173 (casca) e 5274 (página de incorporação).
- Dois ids diferentes podem, raramente, cair no mesmo par (são 450 pares); se isso acontecer, o Vite recusa subir (`strictPort`) e basta trocar o id.
- O `pnpm e2e:real` também usa o id: o `playwright.config.ts` deriva dele as portas do casca e da página de incorporação nos dois modos (sem `E2E_SHELL_URL`). Sem o id, ficam 5173 e 5274. Ele roda só na integração do checkpoint, não em paralelo.
- Com o id no `e2e:real`, a origem do casca passa a ser `http://localhost:<porta derivada do id>` (a porta par da faixa 6100 a 6999; `node -e "import('./scripts/e2e-ports.mjs').then(m=>console.log(m.e2ePorts()))"` com o id exportado mostra o par). Essa origem precisa estar na lista de origens permitidas do CORS da API, senão todo login dá preflight 400. Ponha-a na variável de ambiente `FLUXO_CORS_ORIGINS` (origens separadas por vírgula; `cors_origins` em `backend/src/fluxo/bootstrap/settings.py`) **do próprio processo da API**, ao subir (por exemplo `FLUXO_CORS_ORIGINS=http://localhost:5173,http://localhost:6102 uv run python -m fluxo.bootstrap api`), sem editar o `backend/.env`. Se a API já estiver no ar com outro valor, suba outra, ou use o id vazio.

## Prova visual das telas

O `pnpm e2e:visual` roda o projeto `visual` do Playwright (`e2e/visual/`), **fora do `pnpm e2e`**, e entra no portão de cada épico. Ele usa a API simulada (a mesma do `pnpm e2e`, com a conta Admin, o catálogo e a "Pontuação de exemplo") e, para cada tema (`colorScheme` claro e escuro) e cada largura (1440, 1180 e 900 px), abre: entrar, Início, Administração, Catálogo (Conexões, Datasets e Arquivos), lista de workflows, Visão geral e o editor (canvas, propriedades, grade da Tabela de Decisão e Calcular com o resultado).

- As capturas ficam em `e2e/visual/__screenshots__/<tela>-<tema>-<largura>.png` e são regravadas a cada execução; não há comparação de pixels (datas e ids variam). Quem verifica confere as imagens a olho contra o estilos §12 a §16.
- Três checagens automáticas, em cada captura: nenhuma barra de rolagem horizontal; contraste de texto de pelo menos 4,5:1 (estilos §11) nas cores calculadas; e o menu lateral com nomes e 240 px a partir de 1180 px, só com ícones (64 px) abaixo disso (o menu só é conferido nas telas do casca).
- O texto na cor terciária (`--fc-text-tertiary`, gray-700, 3,23:1 no claro) não reprova: o estilos §11 o permite só para informação não essencial, o que uma máquina não julga. Ele aparece como anotação `terciário · <tela>` do teste (no relatório do Playwright), para quem verifica conferir.
- Rode `pnpm build` antes, como no `pnpm e2e`, e use `FLUXO_TEST_ISOLATION_ID` numa worktree. O projeto sobe o mesmo casca do `pnpm e2e`; não rode os dois ao mesmo tempo com o mesmo id.

## Testes ponta a ponta no modo real

O `pnpm e2e:real` roda os testes de `e2e/` no casca contra o back de verdade, com **2 workers**, fixados no próprio script do `package.json`. Nesta máquina, 6 navegadores em paralelo, o Vite dev e a API juntos saturavam CPU e memória, e os logins estouravam o tempo limite (medido na F39, quando o casca ainda subia pelo Vite dev). Rode o comando como está, sem mudar os workers na mão. No modo real, cada teste e cada `expect` têm 60 s de tempo limite, porque o fluxo da auditoria chegou a 33 s sozinho, com a máquina carregada. O `pnpm e2e` (simulado) roda com 4 workers por padrão; a variável `E2E_WORKERS` muda o número (o padrão de metade dos núcleos saturava a CPU no primeiro carregamento do casca, com duas worktrees rodando juntas). Os tempos limite do simulado são os padrão; o login espera a tela aparecer (até 30 s) em vez de contar com o tempo padrão do `expect`.

O Playwright sobe dois servidores, nos dois modos:
- o casca em `http://localhost:5173`, **compilado** (`vite build` em `node_modules/.cache/e2e-shell` e `vite preview`), e não pelo Vite dev. Pelo Vite dev, cada teste começa num navegador sem cache e baixa 41 módulos sem empacotar (só o `zod` tem 2,3 MB). Com 6 workers, abrir o `/sign-in` levava de 11 a 18 s dos 30 s do teste; compilado, menos de 1 s. A compilação roda uma vez, antes dos testes, com o `VITE_API_URL` da rodada. Antes dos testes, o `e2e/support/global-setup.ts` abre o casca uma vez e espera a tela de login, sem chamar a API, nos dois modos;
- a página de teste de incorporação em `http://localhost:5274/embed-test.html` (`apps/shell/vite.embed.config.ts`). Ela é o "hospedeiro" dos testes de incorporação, numa origem diferente da do casca. É a origem que o `prepare-local` do back cadastra como domínio autorizado.

1. Suba o back (veja `../backend/README.md` e `../backend/docs/ambientes.md`): copie o `.env.example` do back para `.env`, rode `docker compose up -d` e depois os comandos abaixo, na pasta `backend`.

```bash
uv run python -m fluxo.bootstrap migrate
uv run python -m fluxo.bootstrap prepare-local
uv run python -m fluxo.bootstrap api
```

   Variáveis do back que o modo real exige (os nomes estão em inglês desde a B49; os antigos estão no `../backend/docs/glossario.md`):

   | Variável do back | Valor no modo real | Por quê |
   |---|---|---|
   | `FLUXO_SHELL_URL` | `http://localhost:5173` | Base do link de redefinição de senha: `<FLUXO_SHELL_URL>/reset-password?token=...`. |
   | `FLUXO_CORS_ORIGINS` | `http://localhost:5173` | A origem do casca; sem ela, todo login dá preflight 400. |
   | `FLUXO_SESSION_SECRET` | qualquer texto longo | Assina o token de incorporação; sem ela, a `api` não sobe. |
   | `FLUXO_LOGIN_IP_LIMIT_PER_MIN` | `1000` | Veja "Limite de logins por IP", abaixo. |
   | `FLUXO_CONNECTIONS_ALLOW_LOOPBACK` | `true` | O `postgres-sample` está em `127.0.0.1`; sem ela, a conexão de exemplo é recusada como destino bloqueado (`connection_target_not_allowed`). |
   | `FLUXO_CONNECTIONS_REQUIRE_TLS` | `false` | O Postgres do Compose não tem TLS; com a exigência ligada, a conexão de exemplo dá `connection_without_tls`. |
   | `AWS_ENDPOINT_URL`, `FLUXO_S3_BUCKET` e as chaves AWS | os do `.env.example` (Moto) | A credencial da conexão é cifrada com a chave KMS do tenant e o Excel vai para o S3; os dois ficam no Moto. Se o Moto reiniciar, as conexões salvas antes deixam de abrir. |

   O `docker compose up -d` do back já sobe o `postgres-sample` (o "banco do cliente" dos testes do Catálogo, na porta `5434`) e o Moto.

   Desde o épico 4, o `migrate` aplica a migration dos workflows e o `prepare-local` cria no tenant **Demonstração** o workflow "Pontuação de exemplo", com o rascunho do exemplo de Contratos do back. Os testes de `e2e/epic-4/` o usam. Rode-os num banco recém-preparado, como nos épicos anteriores.

   Desde o épico 5, o `prepare-local` também carrega a campanha de referência (B98 e B100: as tabelas da campanha no `postgres-sample` e no SQL Server, a planilha de fatores, as conexões, os datasets e as variáveis) e cria o workflow "Campanha de referência". Os testes de `e2e/epic-5/` o usam:
   - `preview-and-calculate.spec.ts` roda a prévia e confere as contagens; escolhe o primeiro registro da amostra em "Escolher registro" e confere o trace, o valor esperado e os valores no canvas; e digita a chave de cada caso de borda da campanha. Nada é salvo: o rascunho é só lido;
   - `build-campaign.spec.ts` monta a campanha pela tela e só roda no simulado (no modo real, ele é pulado com o motivo);
   - `group-visibility-and-run-values.spec.ts` e `accept-first-row.spec.ts` trabalham numa cópia da campanha, criada pela API a partir do rascunho dela (o workflow do `prepare-local` fica como está; as cópias ficam no banco): uma variável de dentro do grupo usada fora vira "não é visível aqui" e é corrigida pelo Output; os valores do canvas somem ao editar; e "Aceitar a primeira linha" pede a confirmação e vai para o rascunho;
   - `roles.spec.ts` entra como o Aprovador (prévia e Calcular, nada salvo) e como o Auditor (só leitura), com as contas `aprovador@demo.local` e `auditor@demo.local` do `prepare-local`.

   O modo real precisa do SQL Server no ar (`docker compose --profile sqlserver up -d`), porque o bloco "Produto" lê dele. Os valores esperados estão em `e2e/epic-5/support/expected.ts`, calculados à mão a partir das regras (`../backend/docs/campanha-de-referencia.md`) e dos dados da B98; os mesmos registros estão no aceite da B100 (`../backend/tests/reference_campaign/`). Os nomes dos blocos que os testes procuram ("Nota", "Loja", "Produto na campanha", "Produto", "Parâmetros", "Pontuação", "Fator da categoria", "Multiplicador", "Pontos base" e "Pontos") são os títulos das regras do documento da campanha. Das contagens da prévia, o modo real confere só as que não dependem de como um registro já ignorado, filtrado ou com erro conta nos blocos seguintes (o contrato não fixa isso); as outras ficam para o simulado.

2. Exporte o endereço da API (sem o `/v1`) e as contas que o `prepare-local` imprime (também em `../backend/docs/ambientes.md`):

```bash
export E2E_API_URL=http://localhost:8000
export E2E_ADMIN_EMAIL=admin@demo.local
export E2E_ADMIN_PASSWORD=demo-admin-local
export E2E_TWO_TENANTS_EMAIL=dois.tenants@demo.local
export E2E_TWO_TENANTS_PASSWORD=demo-dois-tenants-local
export E2E_AUDITOR_EMAIL=auditor@demo.local
export E2E_AUDITOR_PASSWORD=demo-auditor-local
export E2E_APPROVER_PASSWORD=demo-aprovador-local
export E2E_SAMPLE_READ_PASSWORD=exemplo_leitura_local
export E2E_SAMPLE_WRITE_PASSWORD=exemplo_escrita_local
```

No PowerShell: `$env:E2E_API_URL='http://localhost:8000'`, e assim por diante.

| Variável do e2e | Obrigatória | O que é |
|---|---|---|
| `E2E_API_URL` | sim | Endereço da API, sem o `/v1`. |
| `E2E_ADMIN_EMAIL` | não (padrão `admin@demo.local`) | E-mail do Admin de demonstração. |
| `E2E_ADMIN_PASSWORD` | sim | Senha do Admin de demonstração. |
| `E2E_TWO_TENANTS_EMAIL`, `E2E_TWO_TENANTS_PASSWORD` | sim | Conta com acesso aos dois tenants de demonstração (troca de tenant). |
| `E2E_AUDITOR_EMAIL` | não (padrão `auditor@demo.local`) | E-mail do Auditor de demonstração (o editor só para leitura, épico 4). |
| `E2E_AUDITOR_PASSWORD` | sim | Senha do Auditor de demonstração (`demo-auditor-local` no ambiente local). |
| `E2E_APPROVER_EMAIL` | não (padrão `aprovador@demo.local`) | E-mail do Aprovador de demonstração (prévia e Calcular sem editar, épico 5). |
| `E2E_APPROVER_PASSWORD` | sim | Senha do Aprovador de demonstração (`demo-aprovador-local` no ambiente local). |
| `E2E_SHELL_URL` | não (padrão `http://localhost:5173`) | Endereço do casca que o Playwright abre. |
| `E2E_SAMPLE_HOST` | não (padrão `127.0.0.1`) | Host do banco de exemplo (`postgres-sample`), visto pela **API** (é ela que conecta, não o navegador). |
| `E2E_SAMPLE_PORT` | não (padrão `5434`) | Porta do banco de exemplo (`FLUXO_SAMPLE_POSTGRES_PORT` do back). |
| `E2E_SAMPLE_DATABASE` | não (padrão `exemplo`) | Nome do banco de exemplo. |
| `E2E_SAMPLE_READ_USER` | não (padrão `exemplo_leitura`) | Usuário só de leitura: a conexão com ele é salva. |
| `E2E_SAMPLE_READ_PASSWORD` | sim | Senha do usuário só de leitura (`exemplo_leitura_local` no ambiente local). |
| `E2E_SAMPLE_WRITE_USER` | não (padrão `exemplo_escrita`) | Usuário que pode gravar: a conexão com ele precisa ser recusada (`connection_not_read_only`). |
| `E2E_SAMPLE_WRITE_PASSWORD` | sim | Senha do usuário que pode gravar (`exemplo_escrita_local` no ambiente local). |

As variáveis do e2e estão em inglês desde a F42 (eram `E2E_ADMIN_SENHA`, `E2E_DOIS_TENANTS_EMAIL`, `E2E_DOIS_TENANTS_SENHA` e `E2E_CASCA_URL`). As credenciais do banco de exemplo estão no `../backend/docs/ambientes.md` ("Banco de exemplo e SQL Server"); só os testes do Catálogo (`e2e/epic-3/`) as pedem, e as senhas não têm padrão, como as das contas.

3. Rode:

```bash
pnpm e2e:real
```

- **Só `E2E_API_URL` basta para o endereço.** O `playwright.config.ts` compila o casca e sobe a página de teste com `VITE_API_URL` igual a `E2E_API_URL`. Se já houver um casca aberto em `localhost:5173` (até um `pnpm dev`), ou uma página de teste em `localhost:5274`, o Playwright os reaproveita com o `VITE_API_URL` que tiverem. Se o casca chamar outra API, os testes reprovam e dizem isso. Nesse caso, feche esse servidor. Um `pnpm dev` reaproveitado também deixa os testes bem mais lentos (veja acima).
- **O casca usa o pacote compilado.** O `apps/shell` importa o `@fluxo/react` do `dist/`: rode `pnpm build` antes do `pnpm e2e` ou do `pnpm e2e:real` depois de mudar o pacote.
- **Limite de logins por IP.** A suíte faz cerca de 27 logins por minuto do mesmo IP, e o back aceita 20 por padrão. Suba a `api` com `FLUXO_LOGIN_IP_LIMIT_PER_MIN=1000`: nenhum fluxo testa esse limite. Com o limite padrão, parte dos logins recebe `429 too_many_attempts`. As tentativas ficam gravadas no banco, então reiniciar a API não zera a contagem.
- **O teste de bloqueio não atinge as contas acima.** Ele erra a senha de um e-mail novo a cada rodada.
- **Os testes do Catálogo deixam dados no tenant de demonstração.** Cada rodada cria conexões, datasets, variáveis e arquivos Excel com um sufixo novo no nome (`Exemplo e2e 1a2b3c4d`), sem apagar os das rodadas anteriores. A planilha enviada é escrita pelo próprio teste (`e2e/epic-3/support/workbook.ts`), com os tipos que o back deve inferir em cada coluna.
- **Os testes dos workflows (`e2e/epic-4/`) usam a "Pontuação de exemplo" do `prepare-local` só para ler.** "Calcular" com `valor_item` 1.500,00, categoria A e meta verdadeira tem de mostrar `pontos` 225,00 e "Regra 2" (o motor do back). O Auditor abre o mesmo workflow só para leitura. Os fluxos que mudam o rascunho (erro de tipo, política "Única", duas abas, recarregar) criam, pela API, uma cópia com sufixo novo no nome (`Pontuação única e2e 1a2b3c4d`), sem apagar as das rodadas anteriores.
- **A senha da conexão nunca volta.** O teste `e2e/epic-3/credential-never-returned.spec.ts` lê o corpo de todas as respostas da API depois do login (salvar, abrir a conexão de novo, testar, recarregar a página) e reprova se alguma trouxer a senha; confere também que a tela, os campos e o armazenamento do navegador não a guardam.

No modo simulado (`pnpm e2e`), o Catálogo é simulado por `e2e/epic-3/support/simulation.ts`, com as mesmas tabelas, view e colunas do `postgres-sample` (o `docker/postgres-sample/init.sql` do back). A planilha não é lida de verdade: a simulação devolve os tipos que o teste declarou para aquele arquivo. Quem prova a inferência é o modo real.

Os workflows são simulados por `e2e/epic-4/support/simulation.ts`, que começa com a "Pontuação de exemplo" do `prepare-local` (o rascunho do exemplo do contrato) e guarda a revisão do rascunho como o back (`409 draft_conflict` na aba atrasada). A análise e o "Calcular" passam por uma leitura pequena da linguagem de fórmula, só para os testes (`e2e/epic-4/support/formula.ts` e `engine.ts`): cobre o que os fluxos do épico 4 usam (contas exatas, `ARRED`, `MÍN`, `SOMA`, `EXISTE`, as células da Tabela de Decisão e o erro de tipo de texto em conta). Quem prova o motor de verdade é o modo real.
