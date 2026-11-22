import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useFitOnResize } from './useFitOnResize';

let observers: ResizeObserverCallback[] = [];

function resize(width: number, height: number) {
  for (const callback of observers) callback([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
}

let onMoveStart: (event: unknown) => void = () => {};

function Frame({ fit }: { fit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  onMoveStart = useFitOnResize(ref, fit);
  return <div ref={ref} />;
}

describe('useFitOnResize', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('enquadra de novo cada vez que a área muda de tamanho', () => {
    const fit = vi.fn();
    render(<Frame fit={fit} />);
    resize(1200, 700);
    expect(fit).toHaveBeenCalledTimes(1);
    resize(900, 700);
    expect(fit).toHaveBeenCalledTimes(2);
  });

  it('não enquadra quando o tamanho é o mesmo', () => {
    const fit = vi.fn();
    render(<Frame fit={fit} />);
    resize(900, 600);
    resize(900, 600);
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it('deixa a vista como está depois que a pessoa a moveu', () => {
    const fit = vi.fn();
    render(<Frame fit={fit} />);
    resize(900, 600);
    onMoveStart(null);
    resize(700, 600);
    expect(fit).toHaveBeenCalledTimes(2);
    onMoveStart(new MouseEvent('mousedown'));
    resize(500, 600);
    expect(fit).toHaveBeenCalledTimes(2);
  });
});
