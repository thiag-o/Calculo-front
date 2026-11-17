# 0031. Escrever o código do front em inglês e os textos para pessoas em português

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** dono do produto (regra de 2026-11-16); sessão global (decisão E3-20 do `docs/plano.md`); registrada na tarefa F41
- **Relacionadas:** [0047 do back](../../../backend/docs/adr/0047-codigo-em-ingles.md) (a mesma regra no back e na API); [0002](0002-pacote-react-sem-iframe.md) (prefixo `fc-`), [0003](0003-codigo-por-verticais.md) (os nomes das verticais mudam), [0004](0004-monorepo-pnpm-vite-changesets.md) (versão maior do pacote), [0005](0005-tipos-da-api-pelo-openapi.md) (`api/generated`); dicionário em [`docs/glossario.md`](../glossario.md)

## Contexto

Até o épico 2, o front nomeava em português as verticais, os arquivos, os componentes, os hooks, as props, as classes CSS, as rotas da URL e os scripts, e a interface pública do `@fluxo/react` também (`<Inicio>`, `tela`, `tema="claro"`, `estilos.css`). Em 2026-11-16 o dono do produto mudou a regra para o back e o front: todo o código em inglês, os textos para pessoas em português. O back registrou a regra e o dicionário da API na ADR 0047 e no `backend/docs/glossario.md` (B46). O front precisa dos nomes que não são da API e de uma troca única, sem duas línguas convivendo no mesmo código.

## Decisão

Seguimos a ADR 0047 do back, com estas regras próprias do front:

- **Em inglês:** pastas e verticais, arquivos, componentes, hooks, funções, variáveis, tipos, props e os valores das props, comentários, nomes de arquivo de teste, classes `fc-`, atributos `data-fc-`, chaves de cache, rotas da URL do casca e do módulo, ids de elemento, scripts do `package.json`, o pacote do casca (`shell`) e os projetos do Playwright.
- **Em português:** o que a pessoa lê (rótulos, títulos, mensagens, `aria-label`, `placeholder`, textos de erro lançados), as descrições de `describe`, `it` e `test`, e a documentação (`docs/`, ADRs, README, plano). Nomes de código citados dentro desses textos usam o nome em inglês.
- **Exceções:** o nome do produto (`@fluxo/react`, `FluxoCalculo` e o prefixo `Fluxo` dos tipos públicos) e os prefixos `fc-`, `--fc-`, `data-fc-` e `fc_`. Os tokens `--fc-*` já eram em inglês e não mudam.
- **A API muda depois, na F42.** Até lá o código usa os caminhos, campos, códigos, permissões e tipos de evento de hoje, em português. Onde um formulário em inglês fala com a API em português, a tradução fica num ponto só: o corpo da chamada e o mapa `campo da API → campo do formulário` dos `messages.ts`.
- **Até a F42, dois resíduos em português são aceitos de propósito:** a rota legada `/redefinir` do casca (o back ainda manda o link com ela; o casca aceita também `/reset-password`) e as propriedades do estado simulado do e2e que espelham o JSON da API (`nome`, `papeis`, `ativo`…). A F42 remove os dois junto com a API.
- **Nome de prop não pode colidir com atributo HTML.** Props de componentes que estendem elementos do React não usam nomes de atributos de `HTMLAttributes` (`color`, `tone`…). Padrão: `Text` usa `variant` e `emphasis`; `Status` e `Badge` usam `tone`; `ApiError` usa o `message` herdado de `Error`, sem campo próprio. Colisão nova entra no glossário.
- **Interface pública numa versão maior,** sem período de compatibilidade: não há hospedeiro externo instalado. A lista do que mudou fica no changeset da F41 e no `docs/incorporacao.md`.
- **O dicionário é o `docs/glossario.md`** (nomes do front) junto com o `backend/docs/glossario.md` (nomes da API). Código novo usa só a coluna "Inglês". Nome que não está em nenhum dos dois entra no glossário do front na mesma tarefa.

## Alternativas consideradas

- **Manter o front em português até a F42:** deixaria o pacote com duas línguas por mais tempo e obrigaria as tarefas do épico 3 (F30 a F35) a nascer com nomes que seriam trocados logo depois.
- **Exportar os nomes antigos como apelidos por uma versão:** custo sem benefício, porque o único hospedeiro é o casca, que muda junto.
- **Traduzir também os nomes da API agora:** a API do back só muda na B48; trocar os tipos antes quebraria o contrato.

## Consequências

- **Bom:** um vocabulário só entre o back, a API e o front; as tarefas do épico 3 nascem em inglês.
- **Ruim:** a interface pública muda numa versão maior (lista no changeset); o histórico do git mostra a troca num commit grande (os arquivos foram movidos com `git mv`, então o histórico de cada um segue); até a F42, o front mistura nomes em inglês com os nomes da API em português.
- **A fazer:** a F42 troca os tipos gerados, as chamadas e os nomes da API e remove a rota legada `/redefinir` do casca (o back ainda manda o link com ela); a troca do `VITE_AMBIENTE` e das variáveis `E2E_*` acompanha o deploy e a F42.
