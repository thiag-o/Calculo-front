import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnnouncement } from './announcement';

describe('useAnnouncement', () => {
  it('um texto igual ao anterior volta com um espaço a mais no fim, para o leitor de tela ler de novo', () => {
    const { result } = renderHook(() => useAnnouncement());
    act(() => result.current[1]('Bloco Pontos removido'));
    const first = result.current[0];
    act(() => result.current[1]('Bloco Pontos removido'));
    const second = result.current[0];
    expect(second).not.toBe(first);
    expect(second.trim()).toBe(first);
    act(() => result.current[1]('Bloco Pontos removido'));
    expect(result.current[0]).toBe(first);
    act(() => result.current[1]('Outro texto'));
    expect(result.current[0]).toBe('Outro texto');
  });
});
