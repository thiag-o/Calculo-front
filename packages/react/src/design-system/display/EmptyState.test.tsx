import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../form';
import { FluxoRoot } from '../root';
import { EmptyState } from '.';

afterEach(cleanup);

describe('EmptyState', () => {
  it('mostra a frase, a ajuda e uma ação que funciona', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(
      <FluxoRoot>
        <EmptyState
          title="Nenhuma execução ainda"
          description="Publique uma versão e execute o primeiro lote."
          action={
            <Button size="small" onClick={onRun}>
              Executar lote
            </Button>
          }
        />
      </FluxoRoot>,
    );
    expect(screen.getByText('Nenhuma execução ainda')).toBeVisible();
    expect(screen.getByText('Publique uma versão e execute o primeiro lote.')).toHaveClass('fc-label-13', 'fc-text-secondary');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('o ícone é decorativo e tem um padrão', () => {
    const { container } = render(<EmptyState title="Nenhum workflow" />);
    const icon = container.querySelector('.fc-empty-state-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });

  it('aceita outro ícone e funciona sem descrição e sem ação', () => {
    const { container } = render(<EmptyState title="Nenhum resultado" icon={<svg data-testid="magnifier" />} />);
    expect(screen.getByTestId('magnifier')).toBeInTheDocument();
    expect(container.querySelector('.fc-empty-state-action')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
