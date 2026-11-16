# Guia de incorporação do `@fluxo/react`

Para quem põe o Fluxo de Cálculo dentro de um sistema hospedeiro (React). O módulo vive na página do hospedeiro, sem iframe (ADR [0002](adr/0002-pacote-react-sem-iframe.md)).

## 1. Instalação e CSS

O pacote sai no GitHub Packages (`.npmrc` na raiz do repositório; o `NODE_AUTH_TOKEN` precisa de `read:packages`).

```bash
pnpm add @fluxo/react
```

Importe o CSS uma vez, no ponto de entrada do hospedeiro:

```ts
import '@fluxo/react/estilos.css';
```

O CSS usa só classes com o prefixo `fc-` e variáveis `--fc-*` declaradas em `.fc-raiz`. Ele não tem reset global e não mexe em `:root`, `body` nem em elementos do hospedeiro.

## 2. Montar o módulo

```tsx
import { FluxoCalculo } from '@fluxo/react';
import '@fluxo/react/estilos.css';

export function TelaFluxo({ token, aoExpirar }: { token: string; aoExpirar: () => void }) {
  return (
    <FluxoCalculo
      apiUrl="https://api.exemplo.com.br"
      token={token}
      navegacao="memoria"
      tema="sistema"
      onSessaoExpirada={aoExpirar}
    />
  );
}
```

### Props de `<FluxoCalculo>`

| Prop | Tipo | O que faz |
|---|---|---|
| `apiUrl` | `string` (obrigatória) | Endereço da API, **sem** o `/v1`. |
| `token` | `string` | Token de incorporação (seção 3). Com ele, o módulo usa `Authorization: Bearer` e o layout incorporado (abas, sem menu lateral). Sem ele, usa o cookie de sessão (modo do app casca). |
| `tela` | `TelaFluxo` | Tela em que o módulo abre: `'inicio'`, `'auditoria'`, `'administracao'`, `'usuarios'`, `'papeis'`, `'integracao'` ou `'seguranca'`. Sem a permissão da tela, abre na primeira tela permitida. |
| `tema` | `'claro' \| 'escuro' \| 'sistema'` | Padrão `'sistema'`. Veja a seção 5. |
| `navegacao` | `'url' \| 'memoria'` | Padrão `'memoria'` com `token`, `'url'` sem. Veja a seção 7. |
| `onEvento` | `(evento: EventoFluxo) => void` | Avisos ao hospedeiro. Nenhum evento é emitido hoje (`EventoFluxo` é `never`); cada épico acrescenta os seus. |
| `onSessaoExpirada` | `() => void` | Chamado quando não há mais sessão. Veja a seção 3. |

Os tipos `FluxoCalculoProps`, `TelaFluxo`, `NavegacaoFluxo`, `EventoFluxo` e `TemaFluxo` também saem do pacote.

### Telas

No modo incorporado, as abas são as telas a que o usuário tem permissão; as sem permissão não aparecem.

| Aba | Permissão | Valores de `tela` |
|---|---|---|
| Início | nenhuma | `inicio` |
| Auditoria | `auditoria.ver` | `auditoria` |
| Administração | a de cada área | `administracao` (primeira área permitida), `usuarios`, `papeis`, `integracao`, `seguranca` |

A aba Administração tem sub-abas, cada uma com a sua permissão, e some se o usuário não tem nenhuma. Quais permissões o usuário tem vem dos papéis que o hospedeiro informa ao pedir o token.

### Componentes por tela

O pacote também exporta `<Inicio>`, `<Auditoria>` e `<Administracao>` (props `aba?` e `aoTrocarAba?`). Eles são as telas que o módulo monta por dentro. `<Auditoria>` e `<Administracao>` dependem do cliente da API, do cache e da raiz do módulo, que só o `<FluxoCalculo>` monta. Por isso, hoje, a forma de mostrar só uma parte é o `<FluxoCalculo tela="auditoria">` (ou outra `tela`), não o componente solto.

`<Entrar>` e `<RedefinirSenha>` (props `apiUrl`, `tema?`; a segunda também `token?` e `onSalvar?`) são telas públicas do app casca e não servem à incorporação.

## 3. Modo token

**A chave de API nunca vai para o navegador.** Quem a guarda e a troca por um token é o backend do hospedeiro.

1. O admin do tenant cria uma chave de API na tela Integração e a guarda no backend do hospedeiro.
2. Quando o usuário do hospedeiro abre a tela do Fluxo, o backend do hospedeiro chama `POST {apiUrl}/v1/incorporacao/sessoes` com `Authorization: Chave <chave>` e o corpo:

   | Campo | Descrição |
   |---|---|
   | `id_externo` | Identificador do usuário no hospedeiro. |
   | `email` | E-mail do usuário. |
   | `nome` | Nome do usuário. |
   | `papeis` | **Nomes** de papéis do tenant (lista vazia vale: usuário sem permissões). |

   A resposta `201` traz `{ token, expira_em }`. O token vale num tenant só, por 15 minutos por padrão (o tenant ajusta).
3. O backend entrega o token ao navegador, que o passa em `token`.

Exemplo do backend do hospedeiro (Node):

```ts
export async function obterTokenFluxo(
  apiUrl: string,
  chaveApi: string, // vem do ambiente do servidor, nunca do navegador
  usuario: { idExterno: string; email: string; nome: string; papeis: string[] },
): Promise<{ token: string; expira_em: string }> {
  const resposta = await fetch(`${apiUrl}/v1/incorporacao/sessoes`, {
    method: 'POST',
    headers: { Authorization: `Chave ${chaveApi}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_externo: usuario.idExterno,
      email: usuario.email,
      nome: usuario.nome,
      papeis: usuario.papeis,
    }),
  });
  if (resposta.status !== 201) {
    const problema = (await resposta.json().catch(() => ({}))) as { codigo?: string };
    throw new Error(`Falha ao obter o token (${resposta.status} ${problema.codigo ?? ''})`);
  }
  return (await resposta.json()) as { token: string; expira_em: string };
}
```

Códigos de erro dessa troca (problem+json, campo `codigo`):

| Status | `codigo` | Quando |
|---|---|---|
| 401 | `chave_invalida` | Cabeçalho ausente ou malformado, chave inexistente ou revogada. |
| 409 | `email_em_uso` | O e-mail já pertence a outro usuário do sistema, não ligado a esse `id_externo`. |
| 422 | `papel_inexistente` | Um nome em `papeis` não existe no tenant. |
| 422 | `dados_invalidos` | Corpo malformado ou campo faltando (`campos` traz o erro de cada um). |

### Renovar o token e `onSessaoExpirada`

O token vence (15 minutos por padrão). Duas formas de renovar:

- **Antes de vencer:** o backend devolve `expira_em`; o hospedeiro pede outro token e passa no `token`. O módulo confere a sessão com `GET /v1/sessao`. Se for a mesma pessoa e o mesmo tenant, mantém a tela e os dados; se for outra pessoa ou outro tenant, descarta o cache (ADR [0024](adr/0024-troca-de-token-confere-a-sessao.md)).
- **Depois de vencer:** a API responde `401 sem_sessao` e o módulo chama `onSessaoExpirada`, **uma vez por token** (ADR [0019](adr/0019-encerramento-de-sessao-no-modulo.md)). O módulo mostra o aviso de sessão encerrada e limpa o cache. O hospedeiro pede um token novo e o passa em `token`.

O mesmo `onSessaoExpirada` é chamado quando a pessoa usa "Sair" do módulo.

```tsx
import { FluxoCalculo } from '@fluxo/react';
import { useCallback, useEffect, useState } from 'react';

// `pedirToken` chama o backend do hospedeiro, que usa a função da seção anterior.
export function FluxoDoHospedeiro({ pedirToken }: { pedirToken: () => Promise<string> }) {
  const [token, setToken] = useState<string | null>(null);
  const renovar = useCallback(() => {
    void pedirToken().then(setToken);
  }, [pedirToken]);
  useEffect(renovar, [renovar]);

  if (token === null) return <p>Carregando…</p>;
  return <FluxoCalculo apiUrl="https://api.exemplo.com.br" token={token} onSessaoExpirada={renovar} />;
}
```

### Domínios autorizados

Com token, a API confere o cabeçalho `Origin` da requisição: ele precisa estar entre os **domínios autorizados** do tenant (cadastrados na tela Integração, `/v1/dominios-autorizados`). Senão, a resposta é `403 origem_nao_autorizada`. Cadastre a origem do hospedeiro com esquema, host e porta (por exemplo `https://app.exemplo.com.br`). Em desenvolvimento, cadastre também `http://localhost:<porta>`.

### Página de teste

O repositório traz uma página que faz o papel do backend do hospedeiro, só para uso local (ela mostra um aviso: a chave não deve ir ao navegador em produção):

```bash
pnpm --filter casca exec vite --config vite.incorporacao.config.ts
```

Ela sobe em `http://localhost:5274`, que precisa estar nos domínios autorizados do tenant. Você informa a chave de API, o e-mail, o nome e os papéis; ela troca a chave por um token e monta `<FluxoCalculo token navegacao="memoria">`.

## 4. Erros que o módulo mostra

Os códigos gerais das rotas protegidas são `401 sem_sessao` (leva ao `onSessaoExpirada`), `403 sem_permissao` e `403 origem_nao_autorizada`. A lista completa está no contrato (`backend/contratos/openapi.yaml`). As telas decidem pelo `codigo`, nunca pelo texto.

## 5. Tema e sobrescrita de tokens

`tema` define o esquema de cores:

- `'claro'` e `'escuro'` fixam o tema (atributo `data-theme` na raiz do módulo);
- `'sistema'` (padrão) segue `prefers-color-scheme`.

Os tokens `--fc-*` ficam em `.fc-raiz`, com especificidade zero (`:where()`), então um seletor simples do hospedeiro vence nos dois temas:

```css
.fc-raiz {
  --fc-primary: #0b5fff;
  --fc-primary-hover: #0a4fd6;
}
```

Os nomes (cores `--fc-gray-*`, `--fc-blue-*`, semânticas como `--fc-primary`, `--fc-text`, `--fc-border`, fontes `--fc-font-sans` e `--fc-font-mono`) estão em `packages/react/src/design-system/tokens/tokens.css`. As fontes Geist vêm locais, sem pedir nada a CDN.

## 6. Convivência com a página

Sem iframe, o módulo divide o documento com o hospedeiro. Dois comportamentos merecem atenção (ADR [0014](adr/0014-comportamento-modal-do-radix-no-hospedeiro.md)).

**Diálogo ou menu aberto (Radix, modal).** Enquanto estiver aberto:

- o `body` fica com a rolagem travada (estilo temporário, removido ao fechar);
- os irmãos do portal recebem `aria-hidden`, **inclusive elementos do hospedeiro**, revertido ao fechar;
- o fundo do diálogo é `position: fixed` sobre a janela inteira, e o foco fica preso no diálogo (o foco volta ao elemento de origem ao fechar, ADR [0026](adr/0026-dialogo-recebe-foco-ao-fechar.md)).

Isso é de propósito: é o que mantém o diálogo acessível. O módulo não desliga nada disso. Consequências para o hospedeiro:

- não dependa de rolar a página nem de ler o `aria-hidden` dos seus elementos enquanto o diálogo estiver aberto;
- não use `aria-hidden` ou `inert` próprio nos pais do módulo, para não brigar com o Radix.

**`z-index`.** O portal é o último filho da raiz do módulo e **não define `z-index`**. Nenhum CSS do módulo usa `z-index`, e não existe token de camada (`--fc-z-*`). Se uma barra ou menu do hospedeiro tem `z-index` positivo, ela pode ficar **acima** do diálogo. Para evitar:

- dê ao contêiner onde você monta o módulo `position: relative` e um `z-index` maior que o das barras fixas do hospedeiro. O diálogo participa desse contexto de empilhamento e fica acima delas;
- ou mantenha as barras do hospedeiro sem `z-index` positivo;
- **não** aplique `transform`, `filter` ou `perspective` no contêiner ou nos pais dele: isso muda a referência do `position: fixed`, e o fundo do diálogo deixa de cobrir a janela;
- o contêiner precisa de largura e altura próprias da região em que o módulo aparece; o módulo não mede a janela inteira.

## 7. Navegação

- **`navegacao="memoria"`** (padrão com `token`): as rotas internas ficam na memória do módulo. A URL do hospedeiro não muda, o botão voltar do navegador não navega dentro do módulo e o hospedeiro não precisa reservar rotas. A tela em que o módulo abre vem de `tela`.
- **`navegacao="url"`** (padrão sem `token`, usado pelo app casca): as rotas internas ficam sincronizadas com a URL, com `basename` fixo em `/` e **sem prop** para mudá-lo (ADR 0017). Só serve a um hospedeiro que monte o módulo na raiz do site e reserve as rotas `/inicio`, `/auditoria` e `/administracao/*`. Se um hospedeiro precisar montar fora da raiz, o `basename` vira prop numa decisão futura.

Para incorporar, use `memoria`.
