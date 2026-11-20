# 0019. Encerramento de sessão: avisar o hospedeiro uma vez por token e limpar o cache depois que o layout sai

- **Status:** aceita, revisar no checkpoint (complementada por [0024](0024-troca-de-token-confere-a-sessao.md), [0048](0048-limpeza-unica-da-sessao-e-telas-remontadas.md) e [0049](0049-marca-da-sessao-antes-de-gravar-no-cache.md))
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F8)
- **Relacionadas:** [0015](0015-cache-na-troca-de-identidade-e-tenant.md) (complementa), [0008](0008-consumo-da-api-pelas-verticais.md)

## Contexto

A ADR 0015 deixou para a F8 limpar o cache quando a sessão expira. Limpar com o layout ainda montado faz as consultas buscarem de novo, receberem 401 e limpar de novo (laço). Além disso, "Sair" fica no módulo (rodapé do menu), porque o casca só exporta `<FluxoCalculo>`, `<Inicio>` e `<Entrar>`.

## Decisão

- `onSessaoExpirada` é chamado uma vez por token, tanto na expiração quanto depois de "Sair".
- O cache é limpo só depois que o layout autenticado sai da tela.
- Renovar token (mesmo usuário) não limpa o cache. Se a identidade puder mudar entre tokens, decidir na F17 se segue a ADR 0015.

## Alternativas consideradas

- **Limpar na hora do 401:** causa o laço 401, limpar, buscar, 401.
- **Avisar a cada 401:** o hospedeiro receberia chamadas repetidas.

## Consequências

- **Bom:** sem laço; o hospedeiro recebe um aviso só.
- **Ruim:** há um intervalo curto em que o cache antigo ainda existe, sem ficar visível.
- **A fazer:** F17 decide a troca de token com identidade diferente.
