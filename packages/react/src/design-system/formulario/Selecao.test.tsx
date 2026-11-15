import '@testing-library/jest-dom/vitest';
import './jsdom.test.apoio';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaizFluxo } from '../raiz';
import { Selecao, type OpcaoSelecao, type SelecaoProps } from '.';

afterEach(cleanup);

const fontes: OpcaoSelecao[] = [
  { valor: 'postgres', rotulo: 'PostgreSQL' },
  { valor: 'sqlserver', rotulo: 'SQL Server' },
  { valor: 'oracle', rotulo: 'Oracle', desabilitada: true },
  { valor: 'excel', rotulo: 'Excel' },
];

function renderizar(props: Partial<SelecaoProps> = {}) {
  return render(
    <RaizFluxo>
      <Selecao rotulo="Tipo de conexão" opcoes={fontes} {...props} />
    </RaizFluxo>,
  );
}

function gatilho(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Tipo de conexão' });
}

describe('Selecao', () => {
  it('é um combobox com o rótulo como nome e o texto de espera', () => {
    renderizar();
    expect(gatilho()).toHaveTextContent('Selecione');
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false');
    expect(gatilho()).toHaveClass('fc-selecao-gatilho');
  });

  it('abre pelo teclado com a lista dentro da raiz do módulo, não no body', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.tab();
    const elemento = gatilho();
    expect(elemento).toHaveFocus();
    await usuario.keyboard('{Enter}');
    const lista = await screen.findByRole('listbox');
    // Aberta, a lista é modal: o resto da página fica aria-hidden.
    expect(elemento).toHaveAttribute('aria-expanded', 'true');
    expect(elemento).toHaveAttribute('aria-controls', lista.id);
    expect(lista.closest('.fc-portais')).not.toBeNull();
    expect(lista.closest('.fc-raiz')).not.toBeNull();
    expect(within(lista).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'PostgreSQL',
      'SQL Server',
      'Oracle',
      'Excel',
    ]);
  });

  it('as setas navegam, Enter escolhe e o foco volta ao gatilho', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    renderizar({ onValueChange: aoMudar });
    await usuario.tab();
    await usuario.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'SQL Server' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(aoMudar).toHaveBeenCalledWith('sqlserver');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(gatilho()).toHaveTextContent('SQL Server');
    expect(gatilho()).toHaveFocus();
  });

  it('pula a opção desabilitada', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    renderizar({ onValueChange: aoMudar, defaultValue: 'sqlserver' });
    await usuario.tab();
    await usuario.keyboard('{Enter}');
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: 'Oracle' })).toHaveAttribute('aria-disabled', 'true');
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Excel' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(aoMudar).toHaveBeenCalledWith('excel');
  });

  it('Esc fecha sem mudar o valor e devolve o foco', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    renderizar({ onValueChange: aoMudar, defaultValue: 'postgres' });
    await usuario.tab();
    await usuario.keyboard(' ');
    await screen.findByRole('listbox');
    await usuario.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(aoMudar).not.toHaveBeenCalled();
    expect(gatilho()).toHaveTextContent('PostgreSQL');
    expect(gatilho()).toHaveFocus();
  });

  it('escolhe pelo mouse', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(gatilho());
    await usuario.click(await screen.findByRole('option', { name: 'Excel' }));
    expect(gatilho()).toHaveTextContent('Excel');
  });

  it('controlada: o valor vem de fora', async () => {
    const usuario = userEvent.setup();
    function Controlada() {
      const [valor, setValor] = useState('excel');
      return (
        <RaizFluxo>
          <Selecao rotulo="Tipo de conexão" opcoes={fontes} value={valor} onValueChange={setValor} />
          <p>Escolhida: {valor}</p>
        </RaizFluxo>
      );
    }
    render(<Controlada />);
    expect(gatilho()).toHaveTextContent('Excel');
    await usuario.tab();
    await usuario.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await usuario.keyboard('{Home}{Enter}');
    expect(screen.getByText('Escolhida: postgres')).toBeInTheDocument();
  });

  it('erro marca aria-invalid; dica e erro descrevem o gatilho', () => {
    renderizar({ dica: 'Fontes que o motor lê', erro: 'Escolha o tipo de conexão' });
    expect(gatilho()).toHaveAttribute('aria-invalid', 'true');
    expect(gatilho()).toHaveAccessibleDescription('Escolha o tipo de conexão Fontes que o motor lê');
  });

  it('desabilitada: fora do Tab e não abre', async () => {
    const usuario = userEvent.setup();
    render(
      <RaizFluxo>
        <Selecao rotulo="Tipo de conexão" opcoes={fontes} disabled />
        <button type="button">Depois</button>
      </RaizFluxo>,
    );
    expect(gatilho()).toBeDisabled();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    await usuario.click(gatilho());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('repassa a ref ao gatilho, para o formulário focar o campo com erro', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <RaizFluxo>
        <Selecao ref={ref} rotulo="Tipo de conexão" opcoes={fontes} />
      </RaizFluxo>,
    );
    expect(ref.current).toBe(gatilho());
  });
});
