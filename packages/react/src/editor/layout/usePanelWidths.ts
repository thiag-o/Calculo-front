import { useLayoutEffect, useState, type RefObject } from 'react';

/** Up to this module width, the editor panels narrow: Camadas 220px and Propriedades 300px (estilos.md §15). */
export const NARROW_PANELS_UP_TO = 1280;

/** `wide`: Camadas 260px and Propriedades 340px. `narrow`: 220px and 300px. */
export type PanelWidths = 'wide' | 'narrow';

/**
 * The editor panel widths for the module width (estilos.md §9 and §15): 260/340, and 220/300 from 1280px down. Measures
 * the module root (`.fc-root`), never the window: inside a host app, the host decides the width (ADR 0002 and 0018).
 * Width 0 (no layout yet) keeps `wide`.
 */
export function usePanelWidths(ref: RefObject<HTMLElement | null>): PanelWidths {
  const [widths, setWidths] = useState<PanelWidths>('wide');

  useLayoutEffect(() => {
    const element = ref.current?.closest<HTMLElement>('.fc-root') ?? ref.current;
    if (!element) return undefined;
    const measure = (width: number) => setWidths(width > 0 && width <= NARROW_PANELS_UP_TO ? 'narrow' : 'wide');
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) measure(last.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return widths;
}
