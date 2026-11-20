import { describe, expect, it } from 'vitest';
import { keep, settle, type KeptObjects } from './keptObjects';

interface Item {
  id: string;
  label: string;
}

describe('keep e settle', () => {
  it('devolve o mesmo objeto enquanto as partes são as mesmas, e um novo quando uma muda', () => {
    const cache: KeptObjects<Item> = new Map();
    const part = { x: 1 };
    const first = keep(cache, 'a', [part, 'Pontos'], () => ({ id: 'a', label: 'Pontos' }));
    expect(keep(cache, 'a', [part, 'Pontos'], () => ({ id: 'a', label: 'outro' }))).toBe(first);
    const changed = keep(cache, 'a', [{ x: 1 }, 'Pontos'], () => ({ id: 'a', label: 'Pontos' }));
    expect(changed).not.toBe(first);
    expect(keep(cache, 'a', [part, 'Pontos'], () => ({ id: 'a', label: 'Pontos' }))).not.toBe(first);
  });

  it('apaga do cache os ids que saíram da lista', () => {
    const cache: KeptObjects<Item> = new Map();
    const a = keep(cache, 'a', [1], () => ({ id: 'a', label: 'A' }));
    const b = keep(cache, 'b', [1], () => ({ id: 'b', label: 'B' }));
    settle(cache, null, [a, b]);
    expect([...cache.keys()]).toEqual(['a', 'b']);
    settle(cache, [a, b], [b]);
    expect([...cache.keys()]).toEqual(['b']);
    // A block that comes back (Ctrl Z) gets a new object, not the one of before it left.
    expect(keep(cache, 'a', [1], () => ({ id: 'a', label: 'A' }))).not.toBe(a);
  });

  it('devolve a lista anterior quando todos os itens são os mesmos objetos', () => {
    const cache: KeptObjects<Item> = new Map();
    const a = { id: 'a', label: 'A' };
    const b = { id: 'b', label: 'B' };
    const previous = [a, b];
    expect(settle(cache, previous, [a, b])).toBe(previous);
    const next = [a, { id: 'b', label: 'B' }];
    expect(settle(cache, previous, next)).toBe(next);
  });
});
