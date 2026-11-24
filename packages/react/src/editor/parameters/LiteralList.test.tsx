import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../../design-system';
import { LiteralList, type LiteralListProps } from './LiteralList';

// The values are fields that read the definition of the draft; the list itself only needs a definition to compare.
const DRAFT = { definition: {} };

vi.mock('../draft', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../draft')>()),
  useDraftEditor: () => DRAFT,
}));

function list(literals: readonly string[], onChange: LiteralListProps['onChange']) {
  return (
    <FluxoRoot>
      <LiteralList {...props(literals, onChange)} />
    </FluxoRoot>
  );
}

function props(literals: readonly string[], onChange: LiteralListProps['onChange']): LiteralListProps {
  return {
    legend: 'Valores permitidos',
    itemLabel: 'Valor permitido',
    addLabel: 'Incluir valor permitido',
    scope: 'categoria',
    type: 'text',
    scale: null,
    literals,
    minimum: 0,
    onChange,
    problemsAt: () => [],
    pathAt: () => null,
  };
}

afterEach(cleanup);

describe('lista de valores de um parâmetro', () => {
  it('leva o foco ao valor que ocupou o lugar do removido', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(list(['"A"', '"B"', '"C"'], vi.fn()));
    await user.click(screen.getByRole('button', { name: 'Remover valor permitido 2 (categoria)' }));
    rerender(list(['"A"', '"C"'], vi.fn()));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remover valor permitido 2 (categoria)' }));
  });

  it('não rouba o foco num render posterior quando a remoção não mudou a lista', async () => {
    const user = userEvent.setup({ delay: null });
    const ignore = vi.fn();
    const { rerender } = render(list(['"A"', '"B"'], ignore));
    await user.click(screen.getByRole('button', { name: 'Remover valor permitido 1 (categoria)' }));
    expect(ignore).toHaveBeenCalledTimes(1);
    // No render came: the mark is dropped within the frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // A later change of the list, from somewhere else, must leave the focus where the person put it.
    const field = screen.getByRole('textbox', { name: 'Valor permitido 1 (categoria)' });
    field.focus();
    rerender(list(['"B"'], ignore));
    expect(document.activeElement).toBe(field);
  });
});
