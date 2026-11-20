import { useLayoutEffect, useState, type RefObject } from 'react';

/** Below this module width, the workflow cards go to 2 columns (estilos.md §15). */
export const TWO_COLUMNS_BELOW = 1180;

/** How many columns of workflow cards. */
export type CardColumns = 2 | 3;

/**
 * Columns of workflow cards for the module width (estilos.md §15; reference screen "D · Início"): 3, and 2 below 1180px.
 * Measures the module root (`.fc-root`), never the window: inside a host app, the host app decides the width
 * (ADR 0002 and 0018). Width 0 (no layout yet) keeps 3.
 */
export function useCardColumns(ref: RefObject<HTMLElement | null>): CardColumns {
  const [columns, setColumns] = useState<CardColumns>(3);

  useLayoutEffect(() => {
    const element = ref.current?.closest<HTMLElement>('.fc-root') ?? ref.current;
    if (!element) return undefined;
    const measure = (width: number) => setColumns(width > 0 && width < TWO_COLUMNS_BELOW ? 2 : 3);
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) measure(last.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
