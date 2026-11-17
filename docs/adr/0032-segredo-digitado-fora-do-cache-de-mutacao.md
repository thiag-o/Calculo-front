# 0032. Segredo digitado pela pessoa: mutação sem variáveis, corpo lido na chamada, `gcTime: 0`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-17
- **Quem decidiu:** orquestração (tarefa F30)
- **Relacionadas:** design.md §4, ADRs 0008, 0021 (complementa)

## Contexto

A ADR 0021 cobre o segredo que a API devolve uma vez. Na F30, a senha da conexão faz o caminho inverso: a pessoa digita e o front envia (teste de credencial, criação de conexão, troca de credencial). O TanStack Query guarda as variáveis de cada mutação (`mutation.state.variables`) enquanto ela existir no cache, e o `gcTime: 0` sozinho não cobre o intervalo em que o diálogo está aberto. A API nunca devolve a credencial, então o risco está só no envio.

## Decisão

- A mutação que leva segredo digitado não recebe variáveis: chama-se `mutate()`.
- O hook recebe uma função (`readBody`) que lê o corpo do formulário na hora da chamada, dentro do `mutationFn`.
- Ela também usa `gcTime: 0` e é criada no componente do diálogo, como na ADR 0021.
- O segredo não vai para variáveis de mutação, chave de consulta, estado global nem armazenamento do navegador. Resultados e erros dessas chamadas não carregam a credencial.
- Teste da tela confere que a senha não aparece no cache de consultas nem no de mutações (inclusive nas variáveis).

## Alternativas consideradas

- **`mutate(corpo)` com `gcTime: 0`:** a senha ficaria em `variables` enquanto o diálogo está aberto.
- **Chamar `reset()` ao fechar:** depende de lembrar; não protege durante o uso.
- **Guardar a senha em estado do pai:** sobrevive ao diálogo.

## Consequências

- **Bom:** a credencial nunca entra no cache do TanStack Query; padrão repetível para qualquer segredo digitado.
- **Ruim:** o hook depende de uma função de leitura do formulário, e o `mutate()` sem argumentos foge do formato usual das mutações.
- **A fazer:** novas telas com senha ou chave digitada seguem este padrão.
