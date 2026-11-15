import '@testing-library/jest-dom/vitest';
import './jsdom.test.apoio';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaixaSelecao } from '.';

afterEach(cleanup);

describe('CaixaSelecao', () => {
  it('é uma caixa de seleção com o rótulo como nome', () => {
    render(<CaixaSelecao rotulo="Lembrar este dispositivo" />);
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' });
    expect(caixa).not.toBeChecked();
    expect(caixa).toHaveClass('fc-caixa-selecao-caixa');
  });

  it('Tab foca e Espaço alterna', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CaixaSelecao rotulo="Encerrar as outras sessões" onCheckedChange={aoMudar} />);
    await usuario.tab();
    const caixa = screen.getByRole('checkbox', { name: 'Encerrar as outras sessões' });
    expect(caixa).toHaveFocus();
    await usuario.keyboard(' ');
    expect(caixa).toBeChecked();
    expect(aoMudar).toHaveBeenLastCalledWith(true);
    await usuario.keyboard(' ');
    expect(caixa).not.toBeChecked();
    expect(aoMudar).toHaveBeenLastCalledWith(false);
  });

  it('Enter não alterna (padrão de caixa de seleção)', async () => {
    const usuario = userEvent.setup();
    render(<CaixaSelecao rotulo="Encerrar as outras sessões" />);
    await usuario.tab();
    await usuario.keyboard('{Enter}');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('clicar no rótulo alterna', async () => {
    const usuario = userEvent.setup();
    render(<CaixaSelecao rotulo="Lembrar este dispositivo" />);
    await usuario.click(screen.getByText('Lembrar este dispositivo'));
    expect(screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' })).toBeChecked();
  });

  it('controlada, inclusive no estado indeterminado (aria-checked="mixed")', async () => {
    const usuario = userEvent.setup();
    function Controlada() {
      const [marcada, setMarcada] = useState<boolean | 'indeterminate'>('indeterminate');
      return <CaixaSelecao rotulo="Selecionar todas" checked={marcada} onCheckedChange={setMarcada} />;
    }
    render(<Controlada />);
    const caixa = screen.getByRole('checkbox', { name: 'Selecionar todas' });
    expect(caixa).toHaveAttribute('aria-checked', 'mixed');
    expect(caixa).toBePartiallyChecked();
    await usuario.click(caixa);
    expect(caixa).toBeChecked();
  });

  it('erro marca aria-invalid; dica e erro descrevem a caixa', () => {
    render(<CaixaSelecao rotulo="Li e aceito os termos" dica="Obrigatório para continuar" erro="Aceite os termos para continuar" />);
    const caixa = screen.getByRole('checkbox', { name: 'Li e aceito os termos' });
    expect(caixa).toHaveAttribute('aria-invalid', 'true');
    expect(caixa).toHaveAccessibleDescription('Aceite os termos para continuar Obrigatório para continuar');
  });

  it('desabilitada: fora do Tab, sem alternar, com o rótulo em terciário', async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <>
        <CaixaSelecao rotulo="Lembrar este dispositivo" disabled />
        <button type="button">Depois</button>
      </>,
    );
    const caixa = screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' });
    expect(caixa).toBeDisabled();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    await usuario.click(screen.getByText('Lembrar este dispositivo'));
    expect(caixa).not.toBeChecked();
    expect(container.querySelector('.fc-caixa-selecao')).toHaveClass('fc-caixa-selecao-desabilitada');
  });

  it('com name, entra no envio do formulário', async () => {
    const usuario = userEvent.setup();
    const enviados: FormData[] = [];
    render(
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviados.push(new FormData(evento.currentTarget));
        }}
      >
        <CaixaSelecao rotulo="Lembrar este dispositivo" name="lembrar" value="sim" />
        <button type="submit">Entrar</button>
      </form>,
    );
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(enviados[0]?.get('lembrar')).toBe('sim');
  });

  it('repassa a ref à caixa', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<CaixaSelecao ref={ref} rotulo="Lembrar este dispositivo" />);
    expect(ref.current).toBe(screen.getByRole('checkbox'));
  });
});
