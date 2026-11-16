# 0023. Parâmetros de segurança: salvar grava a resposta do PUT e não invalida o prefixo (complementa 0020)

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F23)
- **Relacionadas:** ADRs 0003, 0020

## Contexto

A ADR 0020 manda invalidar o prefixo `['administracao']` depois de mutar papéis, porque a aba de usuários mostra dados de papéis. A aba de segurança (`['administracao','seguranca']`) guarda parâmetros que nenhuma outra aba exibe, e o PUT devolve o estado completo salvo.

## Decisão

- A consulta de segurança usa a chave `['administracao','seguranca']`, como manda a 0020.
- No sucesso do salvamento, a aba grava a resposta do PUT com `setQueryData` nessa chave e **não** invalida o prefixo `['administracao']`.
- Regra geral (refina a 0020): invalidar o prefixo só quando outra aba exibe os dados mutados. Mutação cujos dados só a própria aba mostra e que devolve o estado novo atualiza a própria chave.
- Erros pontuais seguem a 0020 (invalidar a chave da própria consulta).

## Alternativas consideradas

- **Invalidar o prefixo como em papéis:** refaz buscas de abas montadas sem necessidade.
- **Invalidar só a chave de segurança:** uma busca a mais, sendo que o PUT já traz o dado.

## Consequências

- **Bom:** sem buscas extras e sem acoplar abas.
- **Ruim:** se outra aba passar a mostrar esses parâmetros, é preciso revisar esta decisão; depende de convenção.
