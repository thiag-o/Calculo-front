# 0071. Comparar pixels no e2e:visual, com máscara nos relógios e tolerância de 2 pixels

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F134)
- **Relacionadas:** ADR 0036 (e2e serve o shell compilado), que esta complementa; ADR 0029

## Contexto

O `e2e:visual` só salvava as capturas e alguém as lia a olho. Os baselines ficaram defasados sem ninguém notar (achado da F121). A D45 escolheu a opção C: comparar de verdade. A diferença real entre baselines e telas atuais era de 0,1% a 3,2%, e a mesma tela renderizada 6 vezes dá 0 pixels de diferença.

## Decisão

- `inspect()` em `e2e/visual/support.ts` compara com `toHaveScreenshot` (`capture: 'compare'`, padrão). `capture: 'save'` existe para tela instável, hoje sem uso.
- A comparação é `expect.soft`: uma tela alterada não esconde as outras nem as checagens de rolagem, contraste e menu.
- Texto que varia por execução (data e hora, "há N min", durações, id curto) é mascarado com `mask: Locator[]`. Em `epic-6-screens.spec.ts` ficam em `clockAreas()`.
- Tolerância no projeto `visual` do `playwright.config.ts`: `threshold: 0.2`, `maxDiffPixels: 2`, `animations: 'disabled'`, `caret: 'hide'`. Se aparecer ruído em outra máquina ou no CI, sobe `maxDiffPixels`, não o `threshold`.
- Os baselines ficam em `e2e/visual/__screenshots__/{arg}{ext}`, sem sufixo de plataforma. São os da máquina que os gravou (Windows, fontes locais). Em outra plataforma, regravar com `--update-snapshots`.
- Mudança visual de propósito: rodar `pnpm build` e depois `e2e:visual --update-snapshots`. O casca roda o `@fluxo/react` compilado, então sem o build a comparação passa com o código velho.
- Quem regrava confere cada diferença e a liga a uma tarefa antes de aceitar.

## Alternativas consideradas

- **Continuar só salvando e lendo a olho (A):** foi o que deixou os baselines apodrecerem.
- **Tolerância larga (150 pixels):** deixa passar um acento tirado de um título (3 a 4 pixels). Rótulo trocado dá 188 a 340, botão que muda de lugar dá milhares.
- **Baselines por plataforma, com sufixo `-win32` e `-linux`:** pede gravar em cada sistema. Fica para quando houver CI em outra plataforma.
- **Fixar o relógio da página em vez de mascarar:** as horas vêm do servidor simulado, então a máscara é mais simples.

## Consequências

- **Bom:** regressão visual falha o teste. Mudança de propósito fica explícita no diff dos PNGs.
- **Ruim:** em outra máquina os baselines podem acusar diferença de fonte. Esquecer o `pnpm build` dá falso verde. Regravar mexe em muitos PNGs de uma vez.
- **A fazer:** a global atualiza a seção do `e2e:visual` no `README.md` (compara pixels, `--update-snapshots`, `pnpm build` antes). Ao ter CI, decidir baselines por plataforma.
