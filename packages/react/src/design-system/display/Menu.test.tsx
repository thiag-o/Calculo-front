import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../form';
import { FluxoRoot } from '../root';
import { Menu, type MenuItem } from '.';

afterEach(cleanup);

const reason = 'Conexão em uso por 2 workflows';

function renderScreen(items?: MenuItem[]) {
  const actions = { download: vi.fn(), reprocess: vi.fn(), exclude: vi.fn() };
  const user = userEvent.setup({ delay: null });
  render(
    <FluxoRoot>
      <Menu
        trigger={<Button iconOnly variant="ghost" label="Mais ações" icon={<svg aria-hidden="true" />} />}
        items={
          items ?? [
            { label: 'Baixar CSV', onSelect: actions.download, icon: <svg data-testid="download-icon" /> },
            { label: 'Reprocessar falhas', onSelect: actions.reprocess },
            { type: 'separator' },
            { label: 'Excluir conexão', onSelect: actions.exclude, danger: true, disabledReason: reason },
          ]
        }
      />
    </FluxoRoot>,
  );
  return { user, actions, trigger: screen.getByRole('button', { name: 'Mais ações' }) };
}

describe('Menu', () => {
  it('o gatilho anuncia o menu e começa fechado', () => {
    const { trigger } = renderScreen();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('abre pelo clique, dentro da raiz do módulo, com os itens e o separador', async () => {
    const { user, trigger } = renderScreen();
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(menu.closest('.fc-portals')).not.toBeNull();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Baixar CSV',
      'Reprocessar falhas',
      `Excluir conexão${reason}`,
    ]);
    expect(screen.getByRole('separator')).toHaveClass('fc-menu-separator');
    expect(screen.getByTestId('download-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('escolhe pelo clique e fecha, devolvendo o foco ao gatilho', async () => {
    const { user, trigger, actions } = renderScreen();
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Baixar CSV' }));
    expect(actions.download).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('teclado: Enter abre, setas navegam, Enter escolhe', async () => {
    const { user, trigger, actions } = renderScreen();
    trigger.focus();
    await user.keyboard('{Enter}');
    const first = await screen.findByRole('menuitem', { name: 'Baixar CSV' });
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Reprocessar falhas' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(actions.reprocess).toHaveBeenCalledTimes(1);
    expect(actions.download).not.toHaveBeenCalled();
  });

  it('Esc fecha sem escolher e devolve o foco', async () => {
    const { user, trigger, actions } = renderScreen();
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
    expect(actions.download).not.toHaveBeenCalled();
  });

  it('ação perigosa fica em vermelho', async () => {
    const { user, trigger } = renderScreen();
    await user.click(trigger);
    expect(await screen.findByRole('menuitem', { name: 'Excluir conexão' })).toHaveClass('fc-menu-item-danger');
  });

  it('desabilitado com motivo: alcançável pelas setas, diz o porquê e não age', async () => {
    const { user, trigger, actions } = renderScreen();
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{End}');
    const exclude = screen.getByRole('menuitem', { name: 'Excluir conexão' });
    expect(exclude).toHaveFocus();
    expect(exclude).toHaveAttribute('aria-disabled', 'true');
    expect(exclude).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
    await user.keyboard('{Enter}');
    expect(actions.exclude).not.toHaveBeenCalled();
    // The menu stays open, with the reason in view.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(exclude);
    expect(actions.exclude).not.toHaveBeenCalled();
  });

  it('itens sem motivo não têm descrição', async () => {
    const { user, trigger } = renderScreen();
    await user.click(trigger);
    const download = await screen.findByRole('menuitem', { name: 'Baixar CSV' });
    expect(download).not.toHaveAttribute('aria-disabled');
    expect(download).not.toHaveAttribute('aria-describedby');
  });
});
