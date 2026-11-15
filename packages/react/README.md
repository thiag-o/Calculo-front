# @fluxo/react

O Fluxo de Cálculo inteiro como pacote React, para ser usado dentro de outras aplicações sem iframe ([ADR 0002](../../docs/adr/0002-pacote-react-sem-iframe.md)).
O app casca (`apps/casca`) é o primeiro hospedeiro e usa este mesmo pacote.

## Organização por verticais ([ADR 0003](../../docs/adr/0003-codigo-por-verticais.md))

O código fica agrupado **pelo que faz**, e não pelo tipo técnico. Em `src/` não há `components/`, `hooks/`, `types/` nem `utils/`: cada pasta é uma **vertical**.

- **O que muda junto fica junto.** Cada vertical guarda os próprios componentes, hooks, queries, tipos e testes.
- **Interface pública.** O `index.ts` da vertical é a única porta de entrada. Outra vertical só importa por ele; o resto da pasta é privado.
- **Código compartilhado.** Vira uma vertical própria, como `design-system` e `api`, que não depende de nenhuma outra.
- **Verificação automática.** O `eslint-plugin-boundaries` confere essas regras (veja `eslint.config.js` na raiz do repositório).
- **Organização interna livre.** Dentro de uma vertical, as pastas ficam a critério de quem constrói. Se a vertical crescer demais, ela se divide em sub-verticais, nunca em pastas por tipo.
- **Pastas por tipo proibidas em qualquer nível:** `components`, `hooks`, `types`, `utils`, `helpers`, `lib`, `shared`, `common`. O lint recusa.
- **Achar a vertical certa:** comece pela rota ou tela que usa o código. Usado por mais de uma rota, ou grande demais, vira vertical própria. Compartilhado com regra de negócio vira vertical; sem regra de negócio vai para o `design-system`.
- **Precisa de algo privado de outra vertical?** A dona expõe no `index.ts`, ou o código vira vertical nova (tarefa própria e ADR). Nunca copiar, nunca importar o interior.

| Vertical | O que guarda |
|---|---|
| `design-system` | Tokens `--fc-*` (claro e escuro), tipografia Geist e componentes base. Referência: `docs/estilos.md` do projeto |
| `api` | Cliente HTTP (token ou cookie), tipos gerados do OpenAPI do back e configuração do TanStack Query |
| `modulo` | `<FluxoCalculo>`, rotas internas e navegação (menu lateral no app, abas quando incorporado) |
| `sessao` | Login do app casca, token de incorporação e permissões do usuário atual |
| `inicio` | Tela Início ("Precisa de você", recentes) |
| `workflows` | Lista, Visão geral, versões, revisão e aprovação, descrição gerada |
| `editor` | Editor de workflow (React Flow): canvas, camadas, propriedades, blocos, grupos e Tabela de Decisão |
| `formula` | Editor de fórmula (Monaco, carregado sob demanda) e a linguagem |
| `testes` | Testes do workflow e arquivo de referência |
| `execucoes` | Lista, painel por execução, árvore de execuções compostas e debug com trace |
| `estados` | Estados, extrato, ajuste com motivo e simulação de cascata |
| `catalogo` | Conexões, datasets, variáveis e relacionamentos |
| `auditoria` | Logs de configuração e de acesso |
| `administracao` | Usuários, papéis, chaves de API e domínios autorizados |
| `notificacoes` | Sino |

A lista é o ponto de partida. Cada vertical nova entra com uma linha nesta tabela.
