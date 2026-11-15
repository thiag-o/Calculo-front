import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { RaizFluxo } from '../raiz';
import { Dica } from '.';

afterEach(cleanup);

function renderizar() {
  render(
    <RaizFluxo>
      <button type="button">Antes</button>
      <Dica conteudo="Calculado às 03:00 de 14/11/2026">
        <a href="#r_1114_002">r_1114_002</a>
      </Dica>
    </RaizFluxo>,
  );
  return { usuario: userEvent.setup(), alvo: screen.getByRole('link', { name: 'r_1114_002' }) };
}

describe('Dica', () => {
  it('fica fechada até o foco ou o hover', () => {
    const { alvo } = renderizar();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(alvo).not.toHaveAttribute('aria-describedby');
  });

  it('abre no foco pelo Tab, dentro da raiz do módulo, e descreve o elemento', async () => {
    const { usuario, alvo } = renderizar();
    await usuario.tab();
    await usuario.tab();
    expect(alvo).toHaveFocus();
    const dica = await screen.findByRole('tooltip');
    expect(dica).toHaveTextContent('Calculado às 03:00 de 14/11/2026');
    expect(document.querySelector('.fc-dica')?.closest('.fc-portais')).not.toBeNull();
    expect(alvo).toHaveAccessibleDescription('Calculado às 03:00 de 14/11/2026');
  });

  it('Esc fecha e o foco fica onde estava', async () => {
    const { usuario, alvo } = renderizar();
    alvo.focus();
    await screen.findByRole('tooltip');
    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(alvo).toHaveFocus();
  });

  it('abre no hover', async () => {
    const { usuario, alvo } = renderizar();
    await usuario.hover(alvo);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Calculado às 03:00 de 14/11/2026');
  });

  it('fecha ao sair do foco', async () => {
    const { usuario, alvo } = renderizar();
    alvo.focus();
    await screen.findByRole('tooltip');
    await usuario.tab({ shift: true });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('respeita o lado pedido', async () => {
    render(
      <RaizFluxo>
        <Dica conteudo="Camadas" lado="direita">
          <button type="button" aria-label="Mostrar camadas" />
        </Dica>
      </RaizFluxo>,
    );
    screen.getByRole('button', { name: 'Mostrar camadas' }).focus();
    await screen.findByRole('tooltip');
    expect(document.querySelector('.fc-dica')).toHaveAttribute('data-side', 'right');
  });
});
