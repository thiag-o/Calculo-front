import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../../design-system';
import '../draft/editor.test-support';
import { EditorLayout, NARROW_PANELS_UP_TO } from '.';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** ResizeObserver that the test triggers with a width. */
function observeWidths() {
  const callbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return (width: number) =>
    act(() => {
      for (const callback of callbacks) callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
    });
}

function renderLayout(width: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  render(
    <FluxoRoot theme="light">
      <EditorLayout
        label="Editor"
        bar={<span>Barra</span>}
        bottomTabs={[{ value: 'problems', label: 'Problemas', content: 'Lista' }]}
        bottomTab="problems"
        onBottomTabChange={() => {}}
        bottomCollapsed={false}
        onBottomCollapsedChange={() => {}}
      />
    </FluxoRoot>,
  );
  return () => screen.getByRole('region', { name: 'Editor' }).firstElementChild!;
}

describe('Editor: larguras dos painéis', () => {
  it('Camadas 260 e Propriedades 340 acima de 1280px do módulo', () => {
    const frame = renderLayout(1440);
    expect(frame()).toHaveAttribute('data-widths', 'wide');
  });

  it('220 e 300 de 1280px para baixo, medindo o módulo, e volta ao crescer', () => {
    const resize = observeWidths();
    const frame = renderLayout(NARROW_PANELS_UP_TO);
    expect(frame()).toHaveAttribute('data-widths', 'narrow');
    resize(1281);
    expect(frame()).toHaveAttribute('data-widths', 'wide');
    resize(1180);
    expect(frame()).toHaveAttribute('data-widths', 'narrow');
  });

  it('sem medida ainda (largura 0), fica com as larguras cheias', () => {
    const frame = renderLayout(0);
    expect(frame()).toHaveAttribute('data-widths', 'wide');
  });

  it('mostra a barra, os três painéis e o painel inferior com as abas', () => {
    renderLayout(1440);
    expect(screen.getByRole('banner')).toHaveTextContent('Barra');
    expect(screen.getByRole('complementary', { name: 'Camadas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Canvas' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Propriedades' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Painel inferior' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Lista');
  });
});
