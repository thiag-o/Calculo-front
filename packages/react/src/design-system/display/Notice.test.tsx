import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../form';
import { FluxoRoot } from '../root';
import { Notice } from '.';

afterEach(cleanup);

const error = 'Não foi possível ler ItensNF.vl_itm: a coluna não existe mais na origem.';

describe('Aviso', () => {
  it('erro é um alerta, anunciado na hora', () => {
    render(<Notice type="error">{error}</Notice>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(error);
    expect(alert).toHaveClass('fc-notice', 'fc-notice-error');
  });

  it.each(['success', 'warning'] as const)('%s é um status, sem interromper o leitor de tela', (type) => {
    render(<Notice type={type}>Versão publicada</Notice>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveClass(`fc-notice-${type}`);
  });

  it('tem um ícone decorativo por tipo', () => {
    const { container } = render(<Notice type="warning">1 teste falhando</Notice>);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
  });

  it('mostra o título antes do texto', () => {
    render(
      <Notice type="error" title="Falha na conexão">
        {error}
      </Notice>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(`Falha na conexão${error}`);
  });

  it('mostra as ações para resolver, fora da nota, e elas funcionam pelo teclado', async () => {
    const user = userEvent.setup();
    const attempt = vi.fn();
    render(
      <FluxoRoot>
        <Notice
          type="error"
          className="fc-catalog-error"
          actions={
            <>
              <Button size="small">Abrir catálogo</Button>
              <Button size="small" variant="ghost" onClick={attempt}>
                Tentar de novo
              </Button>
            </>
          }
        >
          {error}
        </Notice>
      </FluxoRoot>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).not.toContainElement(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(alert.parentElement).toHaveClass('fc-notice-block', 'fc-catalog-error');
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toHaveFocus();
    await user.keyboard(' ');
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
