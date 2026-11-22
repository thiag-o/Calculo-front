import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fits the graph again whenever the canvas area changes size: the first fit (React Flow's `fitView`) runs when the nodes
 * are measured, and the area may still grow or shrink after that (the editor panels take their final widths, the window
 * is resized). Once the person pans or zooms by hand, the view is theirs and stays as it is.
 * Returns the handler for React Flow's `onMoveStart`, which tells a manual move (it has an event) from a programmatic one.
 */
export function useFitOnResize(frame: RefObject<HTMLElement | null>, fit: () => void): (event: unknown) => void {
  const latestFit = useRef(fit);
  latestFit.current = fit;
  const movedByHand = useRef(false);

  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    let size = '';
    let pending = 0;
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) return;
      const next = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (next === size) return;
      size = next;
      if (movedByHand.current) return;
      // One fit per frame, after the layout has settled.
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => latestFit.current());
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(pending);
      observer.disconnect();
    };
  }, [frame]);

  return (event) => {
    if (event) movedByHand.current = true;
  };
}
