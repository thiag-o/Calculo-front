---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**/*.ts"
---
# Regras de testes do front

Adaptado de `rules/react/testing.md` e da skill `e2e-testing` do ECC (MIT).

## Componentes (Vitest + Testing Library)
- Teste o que a pessoa vê e faz, não detalhes de implementação.
- Ordem das consultas: `getByRole` (com `name`), `getByLabelText`, `getByText`. Use `getByTestId` só quando nada mais servir.
- Use `userEvent.setup()` uma vez por teste e sempre com `await` nas interações. Prefira `userEvent` a `fireEvent`.
- Para conteúdo assíncrono, use `findBy*` ou `waitFor`, nunca `setTimeout` seguido de verificação.
- Para afirmar que algo não está na tela, use `queryBy*`.
- Sem snapshot de componente, sem `container.querySelector`, sem mock de hook do React nem de componente filho por padrão.
- Aviso de `act()` indica bug: corrija, não ignore.

## Ponta a ponta (Playwright)
- Localizadores por papel e rótulo (`getByRole`, `getByLabel`), não por classe CSS.
- Espere por estado visível (`expect(...).toBeVisible()`), nunca com `waitForTimeout`.
- Cada teste prepara os próprios dados e não depende da ordem de execução.
