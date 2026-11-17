import '@testing-library/jest-dom/vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TextField, FieldMessage, Label } from '.';

afterEach(cleanup);

describe('TextField', () => {
  it('liga o rótulo ao campo', () => {
    render(<TextField label="E-mail" type="email" />);
    const field = screen.getByRole('textbox', { name: 'E-mail' });
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveClass('fc-field-input');
    expect(screen.getByText('E-mail')).toHaveClass('fc-label', 'fc-label-13', 'fc-text-secondary');
  });

  it('recebe o foco pelo Tab e aceita digitação', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Nome do workflow" onChange={onChange} />);
    await user.tab();
    const field = screen.getByRole('textbox', { name: 'Nome do workflow' });
    expect(field).toHaveFocus();
    await user.keyboard('Pontuação por item de NF');
    expect(field).toHaveValue('Pontuação por item de NF');
    expect(onChange).toHaveBeenCalled();
  });

  it('clicar no rótulo foca o campo', async () => {
    const user = userEvent.setup();
    render(<TextField label="Nome do workflow" />);
    await user.click(screen.getByText('Nome do workflow'));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('a dica descreve o campo', () => {
    render(<TextField label="Filtrar por nome" tooltip="Busca no nome e na descrição" />);
    const field = screen.getByRole('textbox', { name: 'Filtrar por nome' });
    expect(field).toHaveAccessibleDescription('Busca no nome e na descrição');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Busca no nome e na descrição').closest('p')).toHaveClass('fc-label-12', 'fc-text-tertiary');
  });

  it('o erro marca aria-invalid e é lido antes da dica', () => {
    render(<TextField label="E-mail" tooltip="O e-mail de acesso" error="Informe um e-mail válido, como nome@empresa.com.br" />);
    const field = screen.getByRole('textbox', { name: 'E-mail' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Informe um e-mail válido, como nome@empresa.com.br O e-mail de acesso');
    const error = screen.getByText('Informe um e-mail válido, como nome@empresa.com.br').closest('p');
    expect(error).toHaveClass('fc-field-message-error');
    expect(error?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sem erro, não fica inválido nem descrito', () => {
    render(<TextField label="E-mail" error="" />);
    const field = screen.getByRole('textbox', { name: 'E-mail' });
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('mantém o id dado e soma o aria-describedby externo', () => {
    render(
      <>
        <TextField label="Mensagem da versão" id="message" tooltip="Imperativo curto" aria-describedby="counter" />
        <span id="counter">0 de 72</span>
      </>,
    );
    const field = screen.getByRole('textbox', { name: 'Mensagem da versão' });
    expect(field).toHaveAttribute('id', 'message');
    expect(field).toHaveAccessibleDescription('Imperativo curto 0 de 72');
  });

  it('desabilitado: fora do Tab e sem digitação', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextField label="Tenant" disabled defaultValue="Rede Exemplo" />
        <button type="button">Depois</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Tenant' })).toBeDisabled();
  });

  it('obrigatório vira required no campo', () => {
    render(<TextField label="E-mail" required />);
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeRequired();
  });

  it('data: calendário do navegador, com o rótulo, o valor aaaa-mm-dd e o erro', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextField
        label="Até"
        type="date"
        min="2026-11-01"
        onChange={(event) => onChange(event.target.value)}
        error="A data final vem antes da inicial. Ajuste o período."
      />,
    );
    const field = screen.getByLabelText('Até');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveAttribute('min', '2026-11-01');
    expect(field).toHaveClass('fc-field-input');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('A data final vem antes da inicial. Ajuste o período.');

    await user.tab();
    expect(field).toHaveFocus();
    await user.type(field, '2026-11-05');
    expect(field).toHaveValue('2026-11-05');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-05');
  });

  it('repassa a ref ao input e funciona com react-hook-form e zod', async () => {
    const user = userEvent.setup();
    const schema = z.object({ email: z.email('Informe um e-mail válido') });
    const onSubmit = vi.fn();

    function Form() {
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });
      return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <button type="submit">Entrar</button>
        </form>
      );
    }

    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    const field = screen.getByRole('textbox', { name: 'E-mail' });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Informe um e-mail válido');

    await user.type(field, 'ana@empresa.com.br');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@empresa.com.br' }, expect.anything());
  });

  it('a ref aponta para o input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField ref={ref} label="E-mail" />);
    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'E-mail' }));
  });
});

describe('Label e FieldMessage', () => {
  it('compõem um campo próprio', () => {
    render(
      <div>
        <Label htmlFor="period">Período</Label>
        <input id="period" aria-describedby="period-error" />
        <FieldMessage id="period-error" type="error">
          A data final vem antes da inicial. Ajuste o período.
        </FieldMessage>
      </div>,
    );
    expect(screen.getByRole('textbox', { name: 'Período' })).toHaveAccessibleDescription(
      'A data final vem antes da inicial. Ajuste o período.',
    );
  });

  it('a mensagem é dica por padrão, sem ícone', () => {
    render(<FieldMessage>Mínimo de 12 caracteres</FieldMessage>);
    const message = screen.getByText('Mínimo de 12 caracteres').closest('p');
    expect(message).toHaveClass('fc-field-message-tooltip', 'fc-text-tertiary');
    expect(message?.querySelector('svg')).toBeNull();
  });
});
