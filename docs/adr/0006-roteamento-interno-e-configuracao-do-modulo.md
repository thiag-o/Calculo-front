# 0006. Usar react-router com navegação por URL no casca e em memória quando incorporado; `apiUrl` como propriedade do módulo

- **Status:** aceita
- **Data:** 2026-11-15
- **Quem decidiu:** dono do produto (resposta G7 do plano global, 2026-11-15)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md), [0003](0003-codigo-por-verticais.md); design.md §3 e §15

## Contexto

O módulo roda em dois lugares:
- no **app casca**, onde a URL do navegador deve refletir a tela (link direto, voltar);
- **dentro de outros sistemas**, onde o módulo não pode mexer na URL nem no histórico do hospedeiro (ADR 0002: "nada que dependa da janela inteira").

O pacote também não tem variáveis de ambiente próprias: quem o usa precisa dizer onde está a API.

## Decisão

- **Roteamento com `react-router`**, configurado pela propriedade `navegacao` do `<FluxoCalculo>`:
  - `'url'` (casca): roteador ligado à URL, com `basename`;
  - `'memoria'` (padrão quando há `token`): roteador em memória, sem tocar na URL nem no histórico do hospedeiro.
- **`apiUrl` é propriedade obrigatória do `<FluxoCalculo>`**. O casca passa `VITE_API_URL`; o hospedeiro passa o endereço que usa.
- A propriedade `tela` abre o módulo direto numa tela, nos dois modos.

## Alternativas consideradas

- **Roteador próprio por estado:** menos uma dependência, mas reinventa links, parâmetros e proteção de rota.
- **Sempre por URL com hash (`#/...`):** ainda altera a URL do hospedeiro e briga com o roteador dele.

## Consequências

- **Bom:** um código só de rotas para os dois modos; o casca ganha links diretos.
- **Ruim:** no modo memória, o botão "voltar" do navegador não navega dentro do módulo; a navegação é pelas abas e pelo caminho na tela.
