# 0064. Diálogo de envio fica travado até a resposta, para a ação não sair duas vezes

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F101), decidido pela sessão global
- **Relacionadas:** ADRs 0012, 0014, 0026, 0039

## Contexto

O disparo de execuções (F101) envia um lote. Se a pessoa fechasse o diálogo durante o envio e abrisse de novo, o mesmo lote poderia sair duas vezes, e a resposta chegaria a um diálogo que já não é o dela.

## Decisão

- Enquanto o envio está em andamento, o diálogo de disparo não fecha: Esc, clique fora, o botão Fechar (X) e Cancelar não têm efeito.
- O botão de enviar também fica indisponível (com motivo, ADR 0012).
- Ao receber a resposta, com sucesso ou erro, o diálogo volta ao normal. No erro continua aberto, com a mensagem.
- Outros diálogos que enviem ações sem idempotência seguem a mesma regra. Quem precisar fechar durante o envio registra a exceção.

## Alternativas consideradas

- **Deixar fechar e cancelar a requisição:** o servidor pode já ter aceitado o lote; cancelar no cliente não garante nada.
- **Deixar fechar e ignorar a resposta:** a pessoa não sabe se saiu e pode enviar de novo.
- **Só desabilitar o botão de enviar:** fechar e reabrir ainda permitiria um segundo envio.

## Consequências

- **Bom:** o lote nunca sai duas vezes por ação da interface.
- **Ruim:** se a resposta demorar, a pessoa fica presa no diálogo sem saída (o envio tem o tempo limite do cliente da API).
- **A fazer:** nada.
