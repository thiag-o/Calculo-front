# 0014. Aceitar o comportamento modal do Radix sobre a página do hospedeiro

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F5)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md), [0011](0011-tokens-raiz-e-portais-do-modulo.md)

## Contexto

Sem iframe (ADR 0002), o módulo vive na página do hospedeiro. Diálogo e menu do Radix são modais: enquanto abertos, mexem no documento inteiro, não só na raiz do módulo. A `Selecao` da F4 já fazia o mesmo.

## Decisão

Aceitamos o comportamento padrão do Radix e não o contornamos:

- trava a rolagem do `body` (estilo temporário, removido ao fechar);
- aplica `aria-hidden` aos irmãos do portal, inclusive elementos do hospedeiro, revertido ao fechar;
- o fundo do diálogo é `position: fixed` sobre a janela inteira.

O portal é o último filho da `RaizFluxo` e não define `z-index`. Um elemento do hospedeiro (ou do módulo) com `z-index` positivo pode ficar acima do diálogo. Se isso ocorrer, a solução é um token de camada (`--fc-z-*`) em `.fc-raiz`, decidido na F8 (layout) ou com o hospedeiro. Nada disso é desligado por código do módulo.

## Alternativas consideradas

- **`modal={false}` ou desligar a trava e o `aria-hidden`:** o foco escapa do diálogo e o leitor de tela lê a página por trás; perde acessibilidade.
- **Iframe só para os diálogos:** contraria a ADR 0002.
- **`z-index` alto fixo no portal:** vence camadas do hospedeiro sem combinar, e o valor certo depende dele.

## Consequências

- **Bom:** diálogo acessível (foco preso, resto inerte) sem código próprio.
- **Ruim:** o hospedeiro vê a rolagem travada e `aria-hidden` temporário nos elementos dele; barras fixas com `z-index` podem cobrir o diálogo.
- **A fazer:** documentar o comportamento para quem incorpora o módulo; avaliar token de camada na F8.
