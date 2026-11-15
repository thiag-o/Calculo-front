import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao } from '../formulario';
import { RaizFluxo } from '../raiz';
import { Menu, type ItemMenu } from '.';

afterEach(cleanup);

const motivo = 'Conexão em uso por 2 workflows';

function renderizar(itens?: ItemMenu[]) {
  const acoes = { baixar: vi.fn(), reprocessar: vi.fn(), excluir: vi.fn() };
  const usuario = userEvent.setup();
  render(
    <RaizFluxo>
      <Menu
        gatilho={<Botao soIcone variante="fantasma" rotulo="Mais ações" icone={<svg aria-hidden="true" />} />}
        itens={
          itens ?? [
            { rotulo: 'Baixar CSV', aoSelecionar: acoes.baixar, icone: <svg data-testid="icone-baixar" /> },
            { rotulo: 'Reprocessar falhas', aoSelecionar: acoes.reprocessar },
            { tipo: 'separador' },
            { rotulo: 'Excluir conexão', aoSelecionar: acoes.excluir, perigo: true, motivoDesabilitado: motivo },
          ]
        }
      />
    </RaizFluxo>,
  );
  return { usuario, acoes, gatilho: screen.getByRole('button', { name: 'Mais ações' }) };
}

describe('Menu', () => {
  it('o gatilho anuncia o menu e começa fechado', () => {
    const { gatilho } = renderizar();
    expect(gatilho).toHaveAttribute('aria-haspopup', 'menu');
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('abre pelo clique, dentro da raiz do módulo, com os itens e o separador', async () => {
    const { usuario, gatilho } = renderizar();
    await usuario.click(gatilho);
    const menu = await screen.findByRole('menu');
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(menu.closest('.fc-portais')).not.toBeNull();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Baixar CSV',
      'Reprocessar falhas',
      `Excluir conexão${motivo}`,
    ]);
    expect(screen.getByRole('separator')).toHaveClass('fc-menu-separador');
    expect(screen.getByTestId('icone-baixar').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('escolhe pelo clique e fecha, devolvendo o foco ao gatilho', async () => {
    const { usuario, gatilho, acoes } = renderizar();
    await usuario.click(gatilho);
    await usuario.click(await screen.findByRole('menuitem', { name: 'Baixar CSV' }));
    expect(acoes.baixar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(gatilho).toHaveFocus();
  });

  it('teclado: Enter abre, setas navegam, Enter escolhe', async () => {
    const { usuario, gatilho, acoes } = renderizar();
    gatilho.focus();
    await usuario.keyboard('{Enter}');
    const primeiro = await screen.findByRole('menuitem', { name: 'Baixar CSV' });
    await waitFor(() => expect(primeiro).toHaveFocus());
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Reprocessar falhas' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(acoes.reprocessar).toHaveBeenCalledTimes(1);
    expect(acoes.baixar).not.toHaveBeenCalled();
  });

  it('Esc fecha sem escolher e devolve o foco', async () => {
    const { usuario, gatilho, acoes } = renderizar();
    gatilho.focus();
    await usuario.keyboard('{Enter}');
    await screen.findByRole('menu');
    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(gatilho).toHaveFocus();
    expect(acoes.baixar).not.toHaveBeenCalled();
  });

  it('ação perigosa fica em vermelho', async () => {
    const { usuario, gatilho } = renderizar();
    await usuario.click(gatilho);
    expect(await screen.findByRole('menuitem', { name: 'Excluir conexão' })).toHaveClass('fc-menu-item-perigo');
  });

  it('desabilitado com motivo: alcançável pelas setas, diz o porquê e não age', async () => {
    const { usuario, gatilho, acoes } = renderizar();
    gatilho.focus();
    await usuario.keyboard('{Enter}');
    await screen.findByRole('menu');
    await usuario.keyboard('{End}');
    const excluir = screen.getByRole('menuitem', { name: 'Excluir conexão' });
    expect(excluir).toHaveFocus();
    expect(excluir).toHaveAttribute('aria-disabled', 'true');
    expect(excluir).toHaveAccessibleDescription(motivo);
    expect(screen.getByText(motivo)).toBeVisible();
    await usuario.keyboard('{Enter}');
    expect(acoes.excluir).not.toHaveBeenCalled();
    // O menu continua aberto, com o motivo à vista.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await usuario.click(excluir);
    expect(acoes.excluir).not.toHaveBeenCalled();
  });

  it('itens sem motivo não têm descrição', async () => {
    const { usuario, gatilho } = renderizar();
    await usuario.click(gatilho);
    const baixar = await screen.findByRole('menuitem', { name: 'Baixar CSV' });
    expect(baixar).not.toHaveAttribute('aria-disabled');
    expect(baixar).not.toHaveAttribute('aria-describedby');
  });
});
