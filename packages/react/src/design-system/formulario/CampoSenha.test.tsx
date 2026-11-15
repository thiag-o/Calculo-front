import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampoSenha } from '.';

afterEach(cleanup);

function campoSenha(): HTMLInputElement {
  // Campo de senha não tem papel ARIA; o rótulo o encontra.
  return screen.getByLabelText('Senha', { selector: 'input' });
}

describe('CampoSenha', () => {
  it('começa oculta, com o rótulo ligado e autocomplete de senha atual', () => {
    render(<CampoSenha rotulo="Senha" />);
    const campo = campoSenha();
    expect(campo).toHaveAttribute('type', 'password');
    expect(campo).toHaveAttribute('autocomplete', 'current-password');
    expect(campo).toHaveAttribute('spellcheck', 'false');
  });

  it('aceita autocomplete de senha nova', () => {
    render(<CampoSenha rotulo="Senha" autoComplete="new-password" />);
    expect(campoSenha()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('mostra e oculta a senha pelo botão, que diz o estado em aria-pressed', async () => {
    const usuario = userEvent.setup();
    render(<CampoSenha rotulo="Senha" />);
    const campo = campoSenha();
    await usuario.type(campo, 'correta-cavalo-bateria');
    const alternar = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(alternar).toHaveAttribute('aria-pressed', 'false');
    expect(alternar).toHaveAttribute('aria-controls', campo.id);

    await usuario.click(alternar);
    expect(campo).toHaveAttribute('type', 'text');
    expect(alternar).toHaveAttribute('aria-pressed', 'true');
    expect(campo).toHaveValue('correta-cavalo-bateria');

    await usuario.click(alternar);
    expect(campo).toHaveAttribute('type', 'password');
    expect(alternar).toHaveAttribute('aria-pressed', 'false');
  });

  it('pelo teclado: Tab vai do campo ao botão, e Espaço e Enter alternam', async () => {
    const usuario = userEvent.setup();
    render(<CampoSenha rotulo="Senha" />);
    await usuario.tab();
    expect(campoSenha()).toHaveFocus();
    await usuario.tab();
    const alternar = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(alternar).toHaveFocus();
    await usuario.keyboard(' ');
    expect(campoSenha()).toHaveAttribute('type', 'text');
    await usuario.keyboard('{Enter}');
    expect(campoSenha()).toHaveAttribute('type', 'password');
    expect(alternar).toHaveFocus();
  });

  it('o botão de mostrar não envia o formulário', async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn((evento: { preventDefault(): void }) => evento.preventDefault());
    render(
      <form onSubmit={aoEnviar}>
        <CampoSenha rotulo="Senha" />
      </form>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('dica e erro descrevem o campo', () => {
    render(<CampoSenha rotulo="Senha" dica="Mínimo de 12 caracteres" erro="A senha precisa ter 12 caracteres" />);
    const campo = campoSenha();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('A senha precisa ter 12 caracteres Mínimo de 12 caracteres');
  });

  it('desabilitado: o campo e o botão de mostrar ficam desabilitados', () => {
    render(<CampoSenha rotulo="Senha" disabled />);
    expect(campoSenha()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDisabled();
  });

  it('repassa a ref ao input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoSenha ref={ref} rotulo="Senha" name="senha" />);
    expect(ref.current).toBe(campoSenha());
    expect(ref.current).toHaveAttribute('name', 'senha');
  });
});
