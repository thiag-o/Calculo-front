import { describe, expect, it } from 'vitest';
import { FIT_MIN_ZOOM, MIN_ZOOM, fitViewport } from './fitView';

describe('FIT_VIEW', () => {
  it('enquadra o grafo inteiro dentro da área, mesmo um grafo bem mais largo que ela', () => {
    const bounds = { x: 0, y: 0, width: 4200, height: 600 };
    const area = { width: 900, height: 560 };
    const { x, y, zoom } = fitViewport(bounds, area);
    expect(zoom).toBeLessThan(0.25);
    expect(zoom).toBeGreaterThanOrEqual(FIT_MIN_ZOOM);
    expect(zoom).toBeLessThan(MIN_ZOOM);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(x + bounds.width * zoom).toBeLessThan(area.width);
    expect(y + bounds.height * zoom).toBeLessThan(area.height);
  });

  it('não passa de 1 em um grafo pequeno', () => {
    const { zoom } = fitViewport({ x: 0, y: 0, width: 200, height: 100 }, { width: 900, height: 560 });
    expect(zoom).toBe(1);
  });
});
