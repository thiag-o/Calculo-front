import { useLayoutEffect, useState, type RefObject } from 'react';

/** Below this module width, lists hide the result column (estilos.md §15). */
export const NARROW_BELOW = 1180;

/**
 * Whether the module is narrower than 1180px. Measures the module root (`.fc-root`), never the window: inside a host app,
 * the host app decides the width (ADR 0002 and 0018). Width 0 (no layout yet) counts as wide.
 */
export function useNarrowModule(ref: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current?.closest<HTMLElement>('.fc-root') ?? ref.current;
    if (!element) return undefined;
    const measure = (width: number) => setNarrow(width > 0 && width < NARROW_BELOW);
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) measure(last.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return narrow;
}
