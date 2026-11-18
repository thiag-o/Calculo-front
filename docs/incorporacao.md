# Guia de incorporação do `@fluxo/react`

Para quem põe o Fluxo de Cálculo dentro de um sistema hospedeiro (React). O módulo vive na página do hospedeiro, sem iframe (ADR [0002](adr/0002-pacote-react-sem-iframe.md)).

Os nomes da interface pública (componentes, props e seus valores, tipos, CSS publicado e rotas) estão em inglês desde a versão maior da F41 (ADR [0031](adr/0031-codigo-em-ingles.md)); a lista do que mudou está no changeset `.changeset/f41-codigo-em-ingles.md`. Os caminhos, campos, códigos de erro e permissões da API (`/v1/...`, `external_id`, `code`…) e o cookie de sessão (`fc_session`) estão em inglês desde a F42; os textos para pessoas (`title`, `detail` e as mensagens de `fields`) continuam em português.

## 1. Instalação e CSS

O pacote sai no GitHub Packages (`.npmrc` na raiz do repositório; o `NODE_AUTH_TOKEN` precisa de `read:packages`).

```bash
pnpm add @fluxo/react
```

Importe o CSS uma vez, no ponto de entrada do hospedeiro:

```ts
import '@fluxo/react/styles.css';
```

O CSS usa só classes com o prefixo `fc-` e variáveis `--fc-*` declaradas em `.fc-root`. Ele não tem reset global e não mexe em `:root`, `body` nem em elementos do hospedeiro.

## 2. Montar o módulo

```tsx
import { FluxoCalculo } from '@fluxo/react';
import '@fluxo/react/styles.css';

export function FluxoScreenOnHost({ token, onExpire }: { token: string; onExpire: () => void }) {
  return (
    <FluxoCalculo
      apiUrl="https://api.exemplo.com.br"
      token={token}
      navigation="memory"
      theme="system"
      onSessionExpired={onExpire}
    />
  );
}
```

### Props de `<FluxoCalculo>`

| Prop | Tipo | O que faz |
|---|---|---|
| `apiUrl` | `string` (obrigatória) | Endereço da API, **sem** o `/v1`. |
| `token` | `string` | Token de incorporação (seção 3). Com ele, o módulo usa `Authorization: Bearer` e o layout incorporado (abas, sem menu lateral). Sem ele, usa o cookie de sessão (modo do app casca). |
| `screen` | `FluxoScreen` | Tela em que o módulo abre: `'home'`, `'catalog'`, `'audit'`, `'admin'`, `'users'`, `'roles'`, `'integration'` ou `'security'`. Sem a permissão da tela, abre na primeira tela permitida. |
| `theme` | `'light' \| 'dark' \| 'system'` | Padrão `'system'`. Veja a seção 5. |
| `navigation` | `'url' \| 'memory'` | Padrão `'memory'` com `token`, `'url'` sem. Veja a seção 7. |
| `onEvent` | `(event: FluxoEvent) => void` | Avisos ao hospedeiro. Nenhum evento é emitido hoje (`FluxoEvent` é `never`); cada épico acrescenta os seus. |
| `onSessionExpired` | `() => void` | Chamado quando não há mais sessão. Veja a seção 3. |

Os tipos `FluxoCalculoProps`, `FluxoScreen`, `FluxoNavigation`, `FluxoEvent` e `FluxoTheme` também saem do pacote.

### Telas

No modo incorporado, as abas são as telas a que o usuário tem permissão; as sem permissão não aparecem.

| Aba | Permissão | Valores de `screen` |
|---|---|---|
| Início | nenhuma | `home` |
| Catálogo | `connections.view` | `catalog` |
| Auditoria | `audit.view` | `audit` |
| Administração | a de cada área | `admin` (primeira área permitida), `users`, `roles`, `integration`, `security` |

A aba Catálogo tem as sub-abas Conexões, Datasets e Arquivos (cada uma com a sua permissão; hoje as três pedem `connections.view`) e o detalhe de uma conexão, de um dataset ou de um arquivo abre dentro dela. Quem só tem `connections.view` (Configurador, Auditor) vê o catálogo para leitura, sem destino nem credenciais das conexões; os botões de escrita pedem `connections.manage`, `credentials.manage`, `datasets.manage` e `variables.manage`, cada um na sua ação.

A aba Administração tem sub-abas, cada uma com a sua permissão, e some se o usuário não tem nenhuma. Quais permissões o usuário tem vem dos papéis que o hospedeiro informa ao pedir o token.

### Componentes por tela

Para mostrar só uma parte do produto, sem as abas do módulo, o pacote exporta `<Home>`, `<Catalog>`, `<Audit>` e `<Admin>`. Cada um funciona sozinho, fora do `<FluxoCalculo>`: monta a própria raiz (tokens, tema e portais), o cliente da API e o cache.

```tsx
import { Admin } from '@fluxo/react';
import '@fluxo/react/styles.css';

export function FluxoSettings({ token, onExpire }: { token: string; onExpire: () => void }) {
  return <Admin apiUrl="https://api.exemplo.com.br" token={token} theme="system" onSessionExpired={onExpire} />;
}
```

Props, iguais às do `<FluxoCalculo>` (tipos `HomeProps`, `CatalogProps`, `AuditProps`, `AdminProps` e `StandaloneScreenProps`):

| Prop | Tipo | O que faz |
|---|---|---|
| `apiUrl` | `string` (obrigatória) | Endereço da API, **sem** o `/v1`. |
| `token` | `string` | Com ele, `Authorization: Bearer` (seção 3). Sem ele, o cookie de sessão. |
| `theme` | `'light' \| 'dark' \| 'system'` | Padrão `'system'` (seção 5). |
| `onEvent` | `(event: FluxoEvent) => void` | Como no `<FluxoCalculo>`; nenhum evento hoje. |
| `onSessionExpired` | `() => void` | Como no `<FluxoCalculo>`: uma vez por token, depois de `401 no_session`. |

Não há `screen` nem `navigation`:

- **A navegação é sempre em memória.** As sub-abas da Administração e do Catálogo trocam sem mexer na URL nem no histórico do hospedeiro. Se o hospedeiro usa `react-router`, o componente pode ficar dentro de uma rota dele sem interferir no roteador.
- **Sem permissão para a tela**, aparece o aviso "Você não tem acesso à Auditoria" ("ao Catálogo" ou "à Administração"), com o pedido para falar com o administrador do cliente, e nada da tela é buscado na API.

| Componente | Permissão |
|---|---|
| `<Home>` | nenhuma |
| `<Catalog>` | `connections.view` |
| `<Audit>` | `audit.view` |
| `<Admin>` | pelo menos uma de `users.manage`, `roles.manage`, `integration.manage` e `security.manage`; só as sub-abas permitidas aparecem |

Enquanto a sessão carrega, a tela mostra o esqueleto; se a sessão não abre (por exemplo `403 origin_not_authorized`), mostra o motivo e **Tentar de novo**; depois de `401 no_session`, o aviso de sessão encerrada.

Cada componente é independente: dois na mesma página têm cada um a sua raiz, o seu tema e o seu cache, e cada um confere a sessão (`GET /v1/session`). Para várias telas com cache e sessão comuns, use o `<FluxoCalculo>`. Os diálogos e menus abrem no portal da raiz de cada componente; valem para eles as regras da seção 6.

`<SignIn>` e `<ResetPassword>` (props `apiUrl`, `theme?`; a primeira também `onSignIn?`, a segunda `token?` e `onSave?`) são telas públicas do app casca e não servem à incorporação.

## 3. Modo token

**A chave de API nunca vai para o navegador.** Quem a guarda e a troca por um token é o backend do hospedeiro.

1. O admin do tenant cria uma chave de API na tela Integração e a guarda no backend do hospedeiro.
2. Quando o usuário do hospedeiro abre a tela do Fluxo, o backend do hospedeiro chama `POST {apiUrl}/v1/embed/sessions` com `Authorization: ApiKey <key>` e o corpo:

   | Campo | Descrição |
   |---|---|
   | `external_id` | Identificador do usuário no hospedeiro. |
   | `email` | E-mail do usuário. |
   | `name` | Nome do usuário. |
   | `roles` | **Nomes** de papéis do tenant (lista vazia vale: usuário sem permissões). |

   A resposta `201` traz `{ token, expires_at }`. O token vale num tenant só, por 15 minutos por padrão (o tenant ajusta).
3. O backend entrega o token ao navegador, que o passa em `token`.

Exemplo do backend do hospedeiro (Node):

```ts
export async function getFluxoToken(
  apiUrl: string,
  apiKey: string, // comes from the server environment, never from the browser
  user: { externalId: string; email: string; name: string; roles: string[] },
): Promise<{ token: string; expires_at: string }> {
  const response = await fetch(`${apiUrl}/v1/embed/sessions`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_id: user.externalId,
      email: user.email,
      name: user.name,
      roles: user.roles,
    }),
  });
  if (response.status !== 201) {
    const problem = (await response.json().catch(() => ({}))) as { code?: string };
    throw new Error(`Falha ao obter o token (${response.status} ${problem.code ?? ''})`);
  }
  return (await response.json()) as { token: string; expires_at: string };
}
```

Códigos de erro dessa troca (problem+json, campo `code`):

| Status | `code` | Quando |
|---|---|---|
| 401 | `invalid_api_key` | Cabeçalho ausente ou malformado, chave inexistente ou revogada. |
| 409 | `email_in_use` | O e-mail já pertence a outro usuário do sistema, não ligado a esse `external_id`. |
| 422 | `unknown_role` | Um nome em `roles` não existe no tenant. |
| 422 | `invalid_data` | Corpo malformado ou campo faltando (`fields` traz o erro de cada um). |

### Renovar o token e `onSessionExpired`

O token vence (15 minutos por padrão). Duas formas de renovar:

- **Antes de vencer:** o backend devolve `expires_at`; o hospedeiro pede outro token e passa no `token`. O módulo confere a sessão com `GET /v1/session`. Se for a mesma pessoa e o mesmo tenant, mantém a tela e os dados; se for outra pessoa ou outro tenant, descarta o cache (ADR [0024](adr/0024-troca-de-token-confere-a-sessao.md)).
- **Depois de vencer:** a API responde `401 no_session` e o módulo chama `onSessionExpired`, **uma vez por token** (ADR [0019](adr/0019-encerramento-de-sessao-no-modulo.md)). O módulo mostra o aviso de sessão encerrada e limpa o cache. O hospedeiro pede um token novo e o passa em `token`.

O mesmo `onSessionExpired` é chamado quando a pessoa usa "Sair" do módulo.

```tsx
import { FluxoCalculo } from '@fluxo/react';
import { useCallback, useEffect, useState } from 'react';

// `requestToken` calls the host app backend, which uses the function from the previous section.
export function HostAppFluxo({ requestToken }: { requestToken: () => Promise<string> }) {
  const [token, setToken] = useState<string | null>(null);
  const renew = useCallback(() => {
    void requestToken().then(setToken);
  }, [requestToken]);
  useEffect(renew, [renew]);

  if (token === null) return <p>Carregando…</p>;
  return <FluxoCalculo apiUrl="https://api.exemplo.com.br" token={token} onSessionExpired={renew} />;
}
```

### Domínios autorizados

Com token, a API confere o cabeçalho `Origin` da requisição: ele precisa estar entre os **domínios autorizados** do tenant (cadastrados na tela Integração, `/v1/authorized-domains`). Senão, a resposta é `403 origin_not_authorized`. Cadastre a origem do hospedeiro com esquema, host e porta (por exemplo `https://app.exemplo.com.br`). Em desenvolvimento, cadastre também `http://localhost:<porta>`.

### Página de teste

O repositório traz uma página que faz o papel do backend do hospedeiro, só para uso local (ela mostra um aviso: a chave não deve ir ao navegador em produção):

```bash
pnpm --filter shell exec vite --config vite.embed.config.ts
```

Ela sobe em `http://localhost:5274/embed-test.html`, que precisa estar nos domínios autorizados do tenant. Você informa a chave de API, o e-mail, o nome e os papéis e escolhe o que montar; ela troca a chave por um token e monta `<FluxoCalculo token navigation="memory">` ou só a `<Admin token>` ou a `<Catalog token>` avulsas.

## 4. Erros que o módulo mostra

Os códigos gerais das rotas protegidas são `401 no_session` (leva ao `onSessionExpired`), `403 no_permission` e `403 origin_not_authorized`. A lista completa está no contrato (`backend/contracts/openapi.yaml`). As telas decidem pelo `code`, nunca pelo texto.

## 5. Tema e sobrescrita de tokens

`theme` define o esquema de cores:

- `'light'` e `'dark'` fixam o tema (atributo `data-theme` na raiz do módulo);
- `'system'` (padrão) segue `prefers-color-scheme`.

Os tokens `--fc-*` ficam em `.fc-root`, com especificidade zero (`:where()`), então um seletor simples do hospedeiro vence nos dois temas:

```css
.fc-root {
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

- **`navigation="memory"`** (padrão com `token`): as rotas internas ficam na memória do módulo. A URL do hospedeiro não muda, o botão voltar do navegador não navega dentro do módulo e o hospedeiro não precisa reservar rotas. A tela em que o módulo abre vem de `screen`.
- **`navigation="url"`** (padrão sem `token`, usado pelo app casca): as rotas internas ficam sincronizadas com a URL, com `basename` fixo em `/` e **sem prop** para mudá-lo (ADR 0017). Só serve a um hospedeiro que monte o módulo na raiz do site e reserve as rotas `/home`, `/audit` e `/admin/*`. Se um hospedeiro precisar montar fora da raiz, o `basename` vira prop numa decisão futura.

Para incorporar, use `memory`.
