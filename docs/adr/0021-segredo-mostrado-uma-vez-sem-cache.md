# 0021. Segredo mostrado uma vez: mutação com `gcTime: 0`, presa ao diálogo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F14)
- **Relacionadas:** ADRs 0008, 0015

## Contexto

O link de redefinição de senha (F14) e a chave de API (F16) são devolvidos pela API uma única vez. O TanStack Query guarda o resultado de toda mutação por um tempo, o que deixaria o segredo em memória depois de fechado o diálogo.

## Decisão

- A mutação que devolve segredo usa `gcTime: 0`.
- Ela é criada dentro do componente do diálogo, que só fica montado enquanto o segredo é mostrado. Fechar desmonta e descarta o valor.
- O segredo não vai para chave de consulta, estado global nem armazenamento do navegador.
- Todo teste dessa tela confere que o segredo não aparece no cache de consultas nem no de mutações.

## Alternativas consideradas

- **Guardar o segredo em estado da tela pai:** ele sobrevive ao diálogo e é fácil esquecer de limpar.
- **Deixar o `gcTime` padrão e chamar `reset()` ao fechar:** depende de lembrar de chamar; o `gcTime: 0` protege por padrão.

## Consequências

- **Bom:** o segredo some ao fechar, sem código extra; o teste do cache vira regra repetível.
- **Ruim:** não dá para reabrir o segredo; o usuário precisa gerar outro.
- **A fazer:** a F16 segue este padrão para a chave de API.
