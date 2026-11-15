import * as Dialog from '@radix-ui/react-dialog';
import { cleanup, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { RaizFluxo, usePortalFluxo } from '.';

afterEach(cleanup);

function raizDe(elemento: HTMLElement): HTMLElement {
  const raiz = elemento.closest<HTMLElement>('.fc-raiz');
  if (!raiz) throw new Error('fora da raiz');
  return raiz;
}

describe('RaizFluxo', () => {
  it('envolve o conteúdo numa raiz com o prefixo fc-', () => {
    render(
      <RaizFluxo>
        <p>Execuções recentes</p>
      </RaizFluxo>,
    );
    const raiz = raizDe(screen.getByText('Execuções recentes'));
    expect(raiz.className).toBe('fc-raiz');
  });

  it.each([
    ['claro', 'light'],
    ['escuro', 'dark'],
  ] as const)('tema %s aplica data-theme="%s"', (tema, atributo) => {
    render(
      <RaizFluxo tema={tema}>
        <p>conteúdo</p>
      </RaizFluxo>,
    );
    expect(raizDe(screen.getByText('conteúdo')).getAttribute('data-theme')).toBe(atributo);
  });

  it('o tema padrão é sistema: sem data-theme, segue o prefers-color-scheme', () => {
    render(
      <RaizFluxo>
        <p>conteúdo</p>
      </RaizFluxo>,
    );
    expect(raizDe(screen.getByText('conteúdo')).hasAttribute('data-theme')).toBe(false);
  });

  it('troca o tema sem remontar o conteúdo', () => {
    const { rerender } = render(
      <RaizFluxo tema="claro">
        <input aria-label="Filtrar por nome" />
      </RaizFluxo>,
    );
    const campo = screen.getByLabelText('Filtrar por nome');
    campo.focus();
    rerender(
      <RaizFluxo tema="escuro">
        <input aria-label="Filtrar por nome" />
      </RaizFluxo>,
    );
    expect(screen.getByLabelText('Filtrar por nome')).toBe(campo);
    expect(document.activeElement).toBe(campo);
    expect(raizDe(campo).getAttribute('data-theme')).toBe('dark');
  });

  it('soma as classes extras a fc-raiz', () => {
    render(
      <RaizFluxo className="fc-layout-casca">
        <p>conteúdo</p>
      </RaizFluxo>,
    );
    expect(raizDe(screen.getByText('conteúdo')).className).toBe('fc-raiz fc-layout-casca');
  });
});

describe('contêiner de portais', () => {
  function PortalSimples() {
    const portal = usePortalFluxo();
    return portal ? createPortal(<p>no portal</p>, portal) : null;
  }

  it('fica dentro da raiz do módulo, não no body', () => {
    render(
      <RaizFluxo tema="escuro">
        <PortalSimples />
      </RaizFluxo>,
    );
    const noPortal = screen.getByText('no portal');
    expect(noPortal.parentElement?.classList.contains('fc-portais')).toBe(true);
    expect(raizDe(noPortal).getAttribute('data-theme')).toBe('dark');
  });

  it('recebe o diálogo do Radix dentro da raiz, com o foco nele', () => {
    function DialogoAberto() {
      const portal = usePortalFluxo();
      return (
        <Dialog.Root open>
          {portal && (
            <Dialog.Portal container={portal}>
              <Dialog.Content aria-describedby={undefined}>
                <Dialog.Title>Excluir conexão</Dialog.Title>
                <button type="button">Cancelar</button>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </Dialog.Root>
      );
    }

    render(
      <RaizFluxo>
        <DialogoAberto />
      </RaizFluxo>,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Excluir conexão' });
    expect(dialogo.closest('.fc-portais')).not.toBeNull();
    expect(raizDe(dialogo).contains(dialogo)).toBe(true);
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it('usePortalFluxo fora de uma RaizFluxo é erro, para nenhum portal cair no body', () => {
    function SemRaiz() {
      usePortalFluxo();
      return null;
    }
    const erroOriginal = console.error;
    console.error = () => {};
    try {
      expect(() => render(<SemRaiz />)).toThrow('usePortalFluxo precisa estar dentro de <RaizFluxo>.');
    } finally {
      console.error = erroOriginal;
    }
  });
});
