---
"@fluxo/react": minor
---

Pré-validação, agendamento e arquivo de referência (F122 a F131, épico 7). O módulo passa a ter os agendamentos, a tela Testes e o sino de alertas.

- **Agendamentos:** a tela de execuções (a do cliente e a do workflow) ganha as abas **Execuções** e **Agendamentos**, com rotas próprias no modo `url`: `/executions/schedules` e `/workflows/:id/executions/schedules`. Com `executions.schedule`: **Novo agendamento**, o switch Ativo, **Editar agendamento** e **Remover agendamento**; sem ela, a aba só lê. A Visão geral do workflow mostra "Próxima execução: 01/12 às 02:00 · Fechamento mensal".
- **Testes:** nova rota `/workflows/:id/tests` e item **Testes** no menu do workflow (com `workflows.view`), com o arquivo de referência: enviar, listar, remover e **Simular**. O `<WorkflowsLocation>` de `view: 'executions'` ganha `tab` (`executions` ou `schedules`).
- **Sino de alertas** (com `executions.view`): na barra do conteúdo do casca (56 px, à direita) e, no modo incorporado, no fim da linha das abas. Abrir um alerta o marca como lido e leva à execução ou à aba Agendamentos do workflow. Sem `executions.view`, não há sino nem barra.
- **Painel da execução:** a decisão do alerta da pré-validação (**Prosseguir** e **Cancelar**), os estados novos, a sobreposição no disparo e a comparação de uma simulação com o arquivo de referência.
- Papéis: o Operador agenda e decide o alerta do lote; o Configurador envia o arquivo e simula; o Aprovador simula e vê o diff, sem agendar; o Auditor vê tudo só para leitura, o sino incluído.
