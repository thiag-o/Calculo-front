import '@testing-library/jest-dom/vitest';
import './jsdom.test-support';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from '.';

afterEach(cleanup);

describe('Checkbox', () => {
  it('é uma caixa de seleção com o rótulo como nome', () => {
    render(<Checkbox label="Lembrar este dispositivo" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveClass('fc-checkbox-box');
  });

  it('Tab foca e Espaço alterna', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Encerrar as outras sessões" onCheckedChange={onChange} />);
    await user.tab();
    const checkbox = screen.getByRole('checkbox', { name: 'Encerrar as outras sessões' });
    expect(checkbox).toHaveFocus();
    await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('Enter não alterna (padrão de caixa de seleção)', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Encerrar as outras sessões" />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('clicar no rótulo alterna', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Lembrar este dispositivo" />);
    await user.click(screen.getByText('Lembrar este dispositivo'));
    expect(screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' })).toBeChecked();
  });

  it('controlada, inclusive no estado indeterminado (aria-checked="mixed")', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [checked, setChecked] = useState<boolean | 'indeterminate'>('indeterminate');
      return <Checkbox label="Selecionar todas" checked={checked} onCheckedChange={setChecked} />;
    }
    render(<Controlled />);
    const checkbox = screen.getByRole('checkbox', { name: 'Selecionar todas' });
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    expect(checkbox).toBePartiallyChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('erro marca aria-invalid; dica e erro descrevem a caixa', () => {
    render(<Checkbox label="Li e aceito os termos" tooltip="Obrigatório para continuar" error="Aceite os termos para continuar" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Li e aceito os termos' });
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAccessibleDescription('Aceite os termos para continuar Obrigatório para continuar');
  });

  it('desabilitada: fora do Tab, sem alternar, com o rótulo em terciário', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <Checkbox label="Lembrar este dispositivo" disabled />
        <button type="button">Depois</button>
      </>,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Lembrar este dispositivo' });
    expect(checkbox).toBeDisabled();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    await user.click(screen.getByText('Lembrar este dispositivo'));
    expect(checkbox).not.toBeChecked();
    expect(container.querySelector('.fc-checkbox')).toHaveClass('fc-checkbox-disabled');
  });

  it('com name, entra no envio do formulário', async () => {
    const user = userEvent.setup();
    const sent: FormData[] = [];
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sent.push(new FormData(event.currentTarget));
        }}
      >
        <Checkbox label="Lembrar este dispositivo" name="remember" value="yes" />
        <button type="submit">Entrar</button>
      </form>,
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(sent[0]?.get('remember')).toBe('yes');
  });

  it('repassa a ref à caixa', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} label="Lembrar este dispositivo" />);
    expect(ref.current).toBe(screen.getByRole('checkbox'));
  });
});
