import * as RadixDialog from '@radix-ui/react-dialog';
import { cleanup, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { FluxoRoot, useFluxoPortal } from '.';

afterEach(cleanup);

function rootOf(element: HTMLElement): HTMLElement {
  const root = element.closest<HTMLElement>('.fc-root');
  if (!root) throw new Error('fora da raiz');
  return root;
}

describe('FluxoRoot', () => {
  it('envolve o conteúdo numa raiz com o prefixo fc-', () => {
    render(
      <FluxoRoot>
        <p>Execuções recentes</p>
      </FluxoRoot>,
    );
    const root = rootOf(screen.getByText('Execuções recentes'));
    expect(root.className).toBe('fc-root');
  });

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ] as const)('tema %s aplica data-theme="%s"', (theme, attribute) => {
    render(
      <FluxoRoot theme={theme}>
        <p>conteúdo</p>
      </FluxoRoot>,
    );
    expect(rootOf(screen.getByText('conteúdo')).getAttribute('data-theme')).toBe(attribute);
  });

  it('o tema padrão é sistema: sem data-theme, segue o prefers-color-scheme', () => {
    render(
      <FluxoRoot>
        <p>conteúdo</p>
      </FluxoRoot>,
    );
    expect(rootOf(screen.getByText('conteúdo')).hasAttribute('data-theme')).toBe(false);
  });

  it('troca o tema sem remontar o conteúdo', () => {
    const { rerender } = render(
      <FluxoRoot theme="light">
        <input aria-label="Filtrar por nome" />
      </FluxoRoot>,
    );
    const field = screen.getByLabelText('Filtrar por nome');
    field.focus();
    rerender(
      <FluxoRoot theme="dark">
        <input aria-label="Filtrar por nome" />
      </FluxoRoot>,
    );
    expect(screen.getByLabelText('Filtrar por nome')).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(rootOf(field).getAttribute('data-theme')).toBe('dark');
  });

  it('soma as classes extras a fc-root', () => {
    render(
      <FluxoRoot className="fc-shell-layout">
        <p>conteúdo</p>
      </FluxoRoot>,
    );
    expect(rootOf(screen.getByText('conteúdo')).className).toBe('fc-root fc-shell-layout');
  });
});

describe('contêiner de portais', () => {
  function SimplePortal() {
    const portal = useFluxoPortal();
    return portal ? createPortal(<p>no portal</p>, portal) : null;
  }

  it('fica dentro da raiz do módulo, não no body', () => {
    render(
      <FluxoRoot theme="dark">
        <SimplePortal />
      </FluxoRoot>,
    );
    const inPortal = screen.getByText('no portal');
    expect(inPortal.parentElement?.classList.contains('fc-portals')).toBe(true);
    expect(rootOf(inPortal).getAttribute('data-theme')).toBe('dark');
  });

  it('recebe o diálogo do Radix dentro da raiz, com o foco nele', () => {
    function OpenDialog() {
      const portal = useFluxoPortal();
      return (
        <RadixDialog.Root open>
          {portal && (
            <RadixDialog.Portal container={portal}>
              <RadixDialog.Content aria-describedby={undefined}>
                <RadixDialog.Title>Excluir conexão</RadixDialog.Title>
                <button type="button">Cancelar</button>
              </RadixDialog.Content>
            </RadixDialog.Portal>
          )}
        </RadixDialog.Root>
      );
    }

    render(
      <FluxoRoot>
        <OpenDialog />
      </FluxoRoot>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Excluir conexão' });
    expect(dialog.closest('.fc-portals')).not.toBeNull();
    expect(rootOf(dialog).contains(dialog)).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('useFluxoPortal fora de uma FluxoRoot é erro, para nenhum portal cair no body', () => {
    function NoRoot() {
      useFluxoPortal();
      return null;
    }
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() => render(<NoRoot />)).toThrow('useFluxoPortal precisa estar dentro de <FluxoRoot>.');
    } finally {
      console.error = originalError;
    }
  });
});
