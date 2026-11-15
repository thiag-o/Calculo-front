# 0003. Código organizado por verticais, com fronteiras verificadas

- **Status:** aceita
- **Data:** 2026-11-15
- **Quem decidiu:** dono do produto
- **Relacionadas:** design.md §3 "Front incorporável", §18; [0002](0002-pacote-react-sem-iframe.md); referência: "The Vertical Codebase", TkDodo (https://tkdodo.eu/blog/the-vertical-codebase)

## Contexto

O pacote `@fluxo/react` reúne muitas telas: editor de workflow, fórmulas, execuções, estados, catálogo, administração. Organizar por tipo técnico (`components/`, `hooks/`, `types/`, `utils/`) espalha cada funcionalidade por várias pastas. Assim, uma mudança pequena toca o projeto inteiro e ninguém sabe o que é usado por quem. O backend já se organiza por domínio (backend ADR 0002); o front segue a mesma ideia.

## Decisão

- **Agrupar pelo que o código faz, não pelo tipo técnico.** No topo de `packages/react/src/` não existem `components/`, `hooks/`, `types/` nem `utils/`; cada pasta é uma **vertical** (lista em `packages/react/README.md`).
- **O que muda junto fica junto.** Cada vertical guarda os próprios componentes, hooks, queries, tipos e testes.
- **Interface pública.** Cada vertical tem um `index.ts`. Outra vertical só importa por ele; o resto da pasta é privado.
- **Código compartilhado vira vertical.**
  - `design-system` guarda tokens e componentes base, e `api` guarda o cliente HTTP e os tipos gerados.
  - As duas não dependem de nenhuma outra.
  - Só entra nelas o que é de fato usado por várias verticais. Na dúvida, o código fica na vertical que o usa.
- **Fronteiras verificadas no CI** com `eslint-plugin-boundaries` (`eslint.config.js`):
  - importar de fora sem passar pelo `index.ts` é erro;
  - `design-system` e `api` não importam ninguém;
  - arquivo solto em `src/`, fora de uma vertical, é erro.
- **Dentro da vertical, a organização é livre.** Uma vertical grande se divide em sub-verticais, nunca em pastas por tipo.
- **`src/index.ts`** é a interface pública do pacote e só reexporta o que vem do `index.ts` das verticais.

## Alternativas consideradas

- **Pastas por tipo técnico:** é o padrão de muitos templates, mas espalha cada funcionalidade e esconde dependências.
- **Uma vertical por pacote de workspace (pnpm com `exports`):** a fronteira fica ainda mais forte, mas o produto é publicado como um pacote único. Seria preciso empacotar os internos e versionar tudo junto, e o ganho não compensa agora. Fica como evolução se uma vertical precisar ser publicada à parte.

## Consequências

- **Bom:**
  - cada funcionalidade num lugar só;
  - dependências explícitas e verificadas;
  - fácil de dividir o trabalho entre pessoas e agentes (uma vertical por tarefa).
- **Ruim:** é preciso decidir o que é "compartilhado" com cuidado, para o `design-system` não virar o antigo `utils/`. Algumas importações ficam mais longas.
- **A fazer:** validar a configuração do `eslint-plugin-boundaries` quando as dependências forem instaladas (fase 1).
