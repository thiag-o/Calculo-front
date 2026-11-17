import { useLayoutEffect, useState, type RefObject } from 'react';

/** Below this width, the sidebar becomes icons only (estilos.md §15). */
export const FULL_MENU_WIDTH = 1180;

/**
 * Is the module narrower than 1180px? Measures the width of the module itself, not of the window: inside a
 * host app, the host app decides the width (ADR 0002, estilos.md §15). Width 0 (no layout yet) does not count.
 */
export function useNarrowWidth(ref: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = (width: number) => setNarrow(width > 0 && width < FULL_MENU_WIDTH);
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
