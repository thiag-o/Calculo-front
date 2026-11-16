import { useCallback, type RefObject } from 'react';

/**
 * Devolve o foco depois de fechar um diálogo aberto por item de menu, que não tem gatilho no Radix (ADR 0022): ao
 * botão "…" da linha, marcado com `atributo="<id>"`, ou, se a linha sumiu ou o diálogo era de criar, ao botão
 * principal da seção. A busca é só dentro da seção (nunca no `document`), por causa da incorporação (ADR 0002).
 */
export function useFocoDeVolta(
  secao: RefObject<HTMLElement | null>,
  atributo: string,
  principal: RefObject<HTMLElement | null>,
): (id?: string) => void {
  return useCallback(
    (id?: string) => {
      // Depois do fechamento, quando o Radix já soltou o foco preso no diálogo.
      setTimeout(() => {
        const linha = id ? secao.current?.querySelector<HTMLElement>(`[${atributo}="${id}"]`) : null;
        (linha ?? principal.current)?.focus();
      }, 0);
    },
    [secao, atributo, principal],
  );
}
