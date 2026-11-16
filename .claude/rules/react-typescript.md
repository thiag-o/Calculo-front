---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# Regras de React e TypeScript

Adaptado das regras `typescript`, `react` e `web` do ECC (github.com/affaan-m/ECC, licença MIT), filtradas pelas ADRs deste repositório. Se algo aqui conflitar com uma ADR aceita ou com o `docs/estilos.md`, valem a ADR e o `estilos.md`. A organização de pastas segue só a ADR 0003 (verticais): nenhuma pasta `hooks`, `utils`, `components` etc.

## TypeScript
- Sem `any`. Dado externo chega como `unknown` e é estreitado antes do uso.
- Tipos explícitos de parâmetro e retorno em tudo que é exportado; deixe o resto ser inferido.
- Prefira união de literais a `enum`.
- Tipos da API só os gerados do OpenAPI (ADR 0005), nunca escritos à mão.
- Atualização imutável (`{ ...obj, campo }`, `Readonly<T>`); não mute props nem estado.
- Nada de `console.log`. Erro em `catch` é tratado ou relançado, nunca engolido.

## Hooks
- Hooks só no topo do componente ou de outro hook: nunca em condição, laço ou depois de um `return`.
- `useEffect` só sincroniza com algo externo (assinatura, API do navegador, biblioteca). Estado derivado é calculado durante a renderização; para reiniciar estado quando uma prop muda, use `key`.
- Todo efeito com assinatura, timer, listener ou requisição devolve a limpeza (`AbortController`, `clearInterval`, `removeEventListener`).
- Dependências completas; nunca silencie a regra sem um comentário que explique.
- Não memorize por padrão. Use `useMemo` ou `useCallback` só quando a identidade importa (filho memorizado, dependência de outro hook) ou quando o custo foi medido.
- Atualização que depende do valor anterior usa a forma funcional (`set(c => c + 1)`).
- Nunca leia nem escreva `ref.current` durante a renderização.
- Extraia um hook próprio só quando houver dois usos reais.

## Segurança
- `dangerouslySetInnerHTML` só com origem documentada e conteúdo sanitizado no mesmo ponto.
- URL vinda de dado é validada (`http:`, `https:`, `mailto:`) antes de ir para `href` ou `src`.
- `target="_blank"` sempre com `rel="noopener noreferrer"`.
- Variáveis `VITE_*` vão para o pacote público: nada sensível nelas.
- Nunca guarde token de sessão em `localStorage`. Esconder um botão não é controle de acesso: quem autoriza é a API.

## Acessibilidade
- HTML semântico primeiro (`button`, `a`, `label`, listas, cabeçalhos em ordem); ARIA só quando o HTML não basta.
- Todo campo tem rótulo associado; todo controle funciona pelo teclado e tem foco visível.
- Modal e menu prendem e devolvem o foco (ver ADR 0014).
