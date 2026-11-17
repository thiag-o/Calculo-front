import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { FluxoRoot } from '../root';
import { Tooltip } from '.';

afterEach(cleanup);

function renderScreen() {
  render(
    <FluxoRoot>
      <button type="button">Antes</button>
      <Tooltip content="Calculado às 03:00 de 14/11/2026">
        <a href="#r_1114_002">r_1114_002</a>
      </Tooltip>
    </FluxoRoot>,
  );
  return { user: userEvent.setup(), target: screen.getByRole('link', { name: 'r_1114_002' }) };
}

describe('Dica', () => {
  it('fica fechada até o foco ou o hover', () => {
    const { target } = renderScreen();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(target).not.toHaveAttribute('aria-describedby');
  });

  it('abre no foco pelo Tab, dentro da raiz do módulo, e descreve o elemento', async () => {
    const { user, target } = renderScreen();
    await user.tab();
    await user.tab();
    expect(target).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Calculado às 03:00 de 14/11/2026');
    expect(document.querySelector('.fc-tooltip')?.closest('.fc-portals')).not.toBeNull();
    expect(target).toHaveAccessibleDescription('Calculado às 03:00 de 14/11/2026');
  });

  it('Esc fecha e o foco fica onde estava', async () => {
    const { user, target } = renderScreen();
    target.focus();
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(target).toHaveFocus();
  });

  it('abre no hover', async () => {
    const { user, target } = renderScreen();
    await user.hover(target);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Calculado às 03:00 de 14/11/2026');
  });

  it('fecha ao sair do foco', async () => {
    const { user, target } = renderScreen();
    target.focus();
    await screen.findByRole('tooltip');
    await user.tab({ shift: true });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('respeita o lado pedido', async () => {
    render(
      <FluxoRoot>
        <Tooltip content="Camadas" side="right">
          <button type="button" aria-label="Mostrar camadas" />
        </Tooltip>
      </FluxoRoot>,
    );
    screen.getByRole('button', { name: 'Mostrar camadas' }).focus();
    await screen.findByRole('tooltip');
    expect(document.querySelector('.fc-tooltip')).toHaveAttribute('data-side', 'right');
  });
});
