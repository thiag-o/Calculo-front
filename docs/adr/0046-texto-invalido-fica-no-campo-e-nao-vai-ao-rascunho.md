# 0046. Texto que daria erro de forma fica no campo e não vai ao rascunho

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F53)
- **Relacionadas:** ADRs 0042, 0043; `packages/react/src/editor/properties/fields.tsx`

## Contexto

O rascunho é salvo sozinho pouco depois de cada mudança (ADR 0043). Se um campo mandar para o rascunho um texto que o backend recusa por forma (`422 invalid_data`, por exemplo nome vazio ou número mal escrito), o salvamento falha a cada tecla e a barra do editor mostra erro enquanto a pessoa ainda está digitando. Todo campo novo do editor (propriedades, grade, canvas) vai ter esse mesmo problema.

## Decisão

- Um texto que daria erro de forma **não vai para o rascunho**. Ele fica no próprio campo, com a mensagem de erro, até ficar válido. Só então o campo chama `change`.
- Ao sair do campo com texto inválido, o campo mostra o erro e continua com o texto digitado; o rascunho segue com o último valor válido.
- Avisos que o backend aceita (por exemplo nome repetido) não seguem essa regra: a mudança vai ao rascunho e o aviso aparece pelo `warn` do campo. O problema da análise, quando chega, tem prioridade sobre o aviso.
- O `CommitTextField` (em `editor/properties`) já faz isso; campo novo do editor usa ele ou segue a mesma regra.

## Alternativas consideradas

- **Mandar tudo ao rascunho e deixar o backend recusar:** o autosave falha a cada tecla e a barra pisca erro.
- **Corrigir o texto sozinho (cortar, trocar por valor padrão):** muda o que a pessoa digitou sem avisar.
- **Validar só ao sair do campo:** a pessoa só descobre o erro depois de seguir adiante.

## Consequências

- **Bom:** o rascunho salvo é sempre válido na forma; a barra só mostra erro de verdade.
- **Ruim:** o texto digitado e o rascunho podem diferir por um tempo; se a pessoa trocar de item no meio, o texto inválido se perde.
- **A fazer:** a grade (F54) e o canvas devem seguir a regra em campos de texto novos.
