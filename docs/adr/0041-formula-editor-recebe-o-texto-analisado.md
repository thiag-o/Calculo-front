# 0041. `<FormulaEditor>` recebe `analyzedValue`: o texto em que os problemas foram calculados

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F52)
- **Relacionadas:** ADR 0037

## Contexto

Os `problems` da API trazem posições (pontos de código) de um texto já enviado à análise, que roda com atraso (cerca de 400 ms) enquanto a pessoa digita. Aplicar essas posições ao texto atual marcaria o trecho errado e ofereceria "Trocar por X" no lugar errado.

## Decisão

- A interface pública do `<FormulaEditor>` ganha `analyzedValue?: string`: o texto que foi enviado na análise que gerou os `problems`.
- Enquanto `analyzedValue` difere de `value`, o editor não marca nada e não oferece "Trocar por X" (nota, correção rápida do Monaco e campo simples). A mensagem na nota e o `aria-invalid` continuam.
- Quem usa o editor com análise atrasada (a F53 e as seguintes) deve passar `analyzedValue`.
- Sem a prop, os problemas valem para o `value` de quando a lista chegou (comparada por conteúdo); na primeira mudança do texto os marcadores somem até chegar uma lista diferente.
- A correção rápida do Monaco também confere, no provedor, se o modelo ainda tem o texto marcado.

## Alternativas consideradas

- **Remapear as posições pela edição feita:** complexo e frágil.
- **Sem a prop, só a regra de "some na primeira mudança":** fica como reserva, mas esconde marcadores que a nova análise repete igual.
- **O editor fazer a análise:** põe consulta da API dentro do componente; a análise é do chamador.

## Consequências

- **Bom:** nunca marca nem corrige o trecho errado.
- **Ruim:** cada chamador precisa guardar o texto enviado na análise.
- **A fazer:** a F53 passa `analyzedValue`.
