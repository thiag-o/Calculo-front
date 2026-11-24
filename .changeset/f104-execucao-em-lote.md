---
"@fluxo/react": minor
---

Execução em lote e entrega em CSV (F97 a F104, épico 6). O módulo passa a ter as execuções: lista, painel de cada uma, disparo e os parâmetros do workflow.

- `<FluxoCalculo>`: novo item "Execuções" no menu e aba no modo incorporado, com `executions.view`. A prop `screen` aceita `'executions'`.
- Rotas internas no modo `url`: `/executions`, `/executions/:id` (painel da execução, com o trace do registro numa gaveta, "Baixar CSV" e "Cancelar execução") e `/workflows/:id/executions` (a lista do workflow). O menu do workflow tem "Visão geral" e "Execuções".
- **Executar lote**: botão no cabeçalho do editor, na Visão geral e na lista de execuções do workflow, só com `executions.trigger`. Executa o rascunho salvo, pede os parâmetros declarados e abre o painel da execução nova. O `<Editor>` e o `<Workflows>` ganham a prop `onOpenExecution`; sem ela, não mostram o botão.
- O pacote exporta `<Executions>` (e `ExecutionsProps`), a lista e o painel das execuções, que funciona sozinha e pede `executions.view`. O `<Workflows>` avulso também leva às execuções ("Executar lote", "Ver execuções" e o painel), sem tocar a URL do hospedeiro. O trace do registro no painel usa a definição congelada da execução.
- Painel do workflow no editor: seções **Parâmetros** (nome, tipo, obrigatório, padrão, valores permitidos e descrição) e **Execução** (limite de erro e nível do trace). `@parâmetro` na fórmula e nos filtros; Prévia e Calcular com o formulário dos parâmetros.
- Sem `executions.view`, a rota do workflow cai na Visão geral, "Ver execuções" some e quem dispara um lote fica onde está, com o aviso de que o lote foi criado. No `<Workflows>` avulso, o "Voltar" do painel leva à origem (Visão geral, lista do workflow ou editor).
- Papéis: o Operador dispara e acompanha; o Aprovador vê a lista e o painel e não dispara; o Auditor vê o painel e o trace, sem "Executar lote" nem "Cancelar execução".
