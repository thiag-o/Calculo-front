import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordField } from '.';

afterEach(cleanup);

function passwordField(): HTMLInputElement {
  // A password field has no ARIA role; the label finds it.
  return screen.getByLabelText('Senha', { selector: 'input' });
}

describe('PasswordField', () => {
  it('começa oculta, com o rótulo ligado e autocomplete de senha atual', () => {
    render(<PasswordField label="Senha" />);
    const field = passwordField();
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    expect(field).toHaveAttribute('spellcheck', 'false');
  });

  it('aceita autocomplete de senha nova', () => {
    render(<PasswordField label="Senha" autoComplete="new-password" />);
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('mostra e oculta a senha pelo botão, que diz o estado em aria-pressed', async () => {
    const user = userEvent.setup({ delay: null });
    render(<PasswordField label="Senha" />);
    const field = passwordField();
    await user.type(field, 'correta-cavalo-bateria');
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-controls', field.id);

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(field).toHaveValue('correta-cavalo-bateria');

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('pelo teclado: Tab vai do campo ao botão, e Espaço e Enter alternam', async () => {
    const user = userEvent.setup({ delay: null });
    render(<PasswordField label="Senha" />);
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveFocus();
    await user.keyboard(' ');
    expect(passwordField()).toHaveAttribute('type', 'text');
    await user.keyboard('{Enter}');
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(toggle).toHaveFocus();
  });

  it('o botão de mostrar não envia o formulário', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="Senha" />
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('dica e erro descrevem o campo', () => {
    render(<PasswordField label="Senha" tooltip="Mínimo de 12 caracteres" error="A senha precisa ter 12 caracteres" />);
    const field = passwordField();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('A senha precisa ter 12 caracteres Mínimo de 12 caracteres');
  });

  it('desabilitado: o campo e o botão de mostrar ficam desabilitados', () => {
    render(<PasswordField label="Senha" disabled />);
    expect(passwordField()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDisabled();
  });

  it('repassa a ref ao input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordField ref={ref} label="Senha" name="password" />);
    expect(ref.current).toBe(passwordField());
    expect(ref.current).toHaveAttribute('name', 'password');
  });
});
