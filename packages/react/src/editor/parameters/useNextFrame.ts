import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs a function on the next frame (to move the focus once the new field is on screen) and cancels the frames still
 * waiting when the component goes away, so nothing runs on a field that is no longer there.
 */
export function useNextFrame(): (run: () => void) => void {
  const frames = useRef(new Set<number>());
  useEffect(() => {
    const pending = frames.current;
    return () => {
      for (const frame of pending) cancelAnimationFrame(frame);
      pending.clear();
    };
  }, []);
  return useCallback((run: () => void) => {
    const frame = requestAnimationFrame(() => {
      frames.current.delete(frame);
      run();
    });
    frames.current.add(frame);
  }, []);
}
