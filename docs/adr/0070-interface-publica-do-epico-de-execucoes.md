# 0070. Interface pública do épico de execuções: `<Executions>` avulso, `<Workflows>` avulso ligado às execuções e origem do painel no estado da navegação

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-24
- **Quem decidiu:** orquestração (tarefa F104), a partir da decisão D42 da sessão global
- **Relacionadas:** ADRs 0003, 0006, 0016, 0028 (complementa), 0050, 0062, 0063 (complementa), 0066

## Contexto

A 0028 pôs a interface pública das telas como avulsas com provedor interno, e a F38 aplicou isso nos épicos anteriores. No épico 6, a F104 integra módulo, editor e execuções. O painel da execução pode ser aberto da Visão geral, da lista do workflow ou do editor, e o "Voltar" precisa levar de volta ao ponto de origem. Além disso, `executions.view` é uma permissão própria: quem dispara um lote pode não ter ela.

## Decisão

- **A F104 é dona da interface pública do épico**, no padrão da 0028: `<Executions>` avulso e `<Workflows>` avulso ligado às execuções (`WorkflowsWithExecutions`, em `module/standalone/`, que liga `renderEditor` e `renderRecordTrace`). Props: as de `TelaAvulsaProps`. As verticais `workflows` e `executions` seguem sem importar `module/` (0003); o sentido `workflows -> executions` já vem da 0063.
- **Origem do painel no estado da navegação.** Ao ir para `/executions/:id`, a navegação leva `location.state.from`. O "Voltar" do painel avulso usa essa origem, e só aceita caminhos que começam por `/workflows`; qualquer outro valor é ignorado e cai na lista de workflows. Não há prop nova em `<Workflows>`. No módulo completo nada muda.
- **Sem `executions.view`, a pessoa fica onde está.** Executar lote não navega para o painel; mostra aviso (Notice na Visão geral, `role="status"` na barra do editor). `/workflows/:id/executions` sem a permissão cai na Visão geral, e o avulso só abre o painel com ela.
- **Troca de tenant com `/executions/:id` aberto** leva para `/executions` (ou `/home` sem a permissão).

## Alternativas consideradas

- **Prop `origin`/`onBack` em `<Workflows>`:** aumenta a interface pública (dívida de semver) para um dado que só existe durante a navegação.
- **Guardar a origem em memória ou na URL:** memória se perde ao recarregar a rota; query string expõe a origem no endereço e aceita qualquer valor.
- **Levar a pessoa ao painel mesmo sem permissão:** abriria uma tela que só mostra "sem acesso" logo após uma ação que deu certo.

## Consequências

- **Bom:** `<Executions>` e `<Workflows>` funcionam sozinhos; o "Voltar" faz sentido sem mudar o contrato; o lote criado não vira beco sem saída.
- **Ruim:** o `state` do histórico não sobrevive a um link aberto direto (cai na lista de workflows). A lista de caminhos aceitos (`/workflows...`) precisa acompanhar novas origens.
- **A fazer:** quem criar nova origem para o painel acrescenta o prefixo à validação do `from` e o teste correspondente.
