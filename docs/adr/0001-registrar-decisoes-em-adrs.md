# 0001. Registrar decisões de arquitetura em ADRs

- **Status:** aceita
- **Data:** 2026-11-15
- **Quem decidiu:** dono do produto
- **Relacionadas:** design.md §16; backend ADR 0001

## Contexto

O desenho do produto está em `docs/design.md`, fora deste repositório. As decisões de *como construir* o front (bibliotecas, estrutura, ferramentas) precisam ficar junto do código, versionadas com ele, e explicar o porquê para quem chegar depois. Isso vale também para os agentes que vão implementar os planos.

## Decisão

- Cada decisão de arquitetura do front vira um arquivo em `docs/adr/`, no formato de [modelo.md](modelo.md): contexto, decisão, alternativas e consequências.
- Numeração sequencial (`0001`, `0002`…); o índice fica em [README.md](README.md).
- Status: **proposta** → **aceita** (ou **descartada**); uma decisão aceita só muda por uma ADR nova que a **substitui**.
- Escrita em português, em linguagem simples.
- O design.md continua sendo a fonte das regras de produto e aponta para esta pasta.

## Alternativas consideradas

- **Só o design.md:** mistura regra de produto com detalhe de código e fica longe do repositório.
- **Wiki externa:** sai do controle de versão e não aparece na revisão de código.

## Consequências

- **Bom:** decisões revisadas no PR, junto com o código que as aplica; histórico do porquê.
- **Ruim:** exige disciplina para escrever a ADR no momento da decisão.
- **A fazer:** definir como as ADRs são anotadas durante a orquestração de planos (pendente no índice).
