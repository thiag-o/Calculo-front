import '@testing-library/jest-dom/vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CampoTexto, MensagemCampo, Rotulo } from '.';

afterEach(cleanup);

describe('CampoTexto', () => {
  it('liga o rótulo ao campo', () => {
    render(<CampoTexto rotulo="E-mail" type="email" />);
    const campo = screen.getByRole('textbox', { name: 'E-mail' });
    expect(campo).toHaveAttribute('type', 'email');
    expect(campo).toHaveClass('fc-campo-entrada');
    expect(screen.getByText('E-mail')).toHaveClass('fc-rotulo', 'fc-label-13', 'fc-texto-secundario');
  });

  it('recebe o foco pelo Tab e aceita digitação', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CampoTexto rotulo="Nome do workflow" onChange={aoMudar} />);
    await usuario.tab();
    const campo = screen.getByRole('textbox', { name: 'Nome do workflow' });
    expect(campo).toHaveFocus();
    await usuario.keyboard('Pontuação por item de NF');
    expect(campo).toHaveValue('Pontuação por item de NF');
    expect(aoMudar).toHaveBeenCalled();
  });

  it('clicar no rótulo foca o campo', async () => {
    const usuario = userEvent.setup();
    render(<CampoTexto rotulo="Nome do workflow" />);
    await usuario.click(screen.getByText('Nome do workflow'));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('a dica descreve o campo', () => {
    render(<CampoTexto rotulo="Filtrar por nome" dica="Busca no nome e na descrição" />);
    const campo = screen.getByRole('textbox', { name: 'Filtrar por nome' });
    expect(campo).toHaveAccessibleDescription('Busca no nome e na descrição');
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Busca no nome e na descrição').closest('p')).toHaveClass('fc-label-12', 'fc-texto-terciario');
  });

  it('o erro marca aria-invalid e é lido antes da dica', () => {
    render(<CampoTexto rotulo="E-mail" dica="O e-mail de acesso" erro="Informe um e-mail válido, como nome@empresa.com.br" />);
    const campo = screen.getByRole('textbox', { name: 'E-mail' });
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Informe um e-mail válido, como nome@empresa.com.br O e-mail de acesso');
    const erro = screen.getByText('Informe um e-mail válido, como nome@empresa.com.br').closest('p');
    expect(erro).toHaveClass('fc-mensagem-campo-erro');
    expect(erro?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sem erro, não fica inválido nem descrito', () => {
    render(<CampoTexto rotulo="E-mail" erro="" />);
    const campo = screen.getByRole('textbox', { name: 'E-mail' });
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo).not.toHaveAttribute('aria-describedby');
  });

  it('mantém o id dado e soma o aria-describedby externo', () => {
    render(
      <>
        <CampoTexto rotulo="Mensagem da versão" id="mensagem" dica="Imperativo curto" aria-describedby="contador" />
        <span id="contador">0 de 72</span>
      </>,
    );
    const campo = screen.getByRole('textbox', { name: 'Mensagem da versão' });
    expect(campo).toHaveAttribute('id', 'mensagem');
    expect(campo).toHaveAccessibleDescription('Imperativo curto 0 de 72');
  });

  it('desabilitado: fora do Tab e sem digitação', async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <CampoTexto rotulo="Tenant" disabled defaultValue="Rede Exemplo" />
        <button type="button">Depois</button>
      </>,
    );
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Tenant' })).toBeDisabled();
  });

  it('obrigatório vira required no campo', () => {
    render(<CampoTexto rotulo="E-mail" required />);
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeRequired();
  });

  it('repassa a ref ao input e funciona com react-hook-form e zod', async () => {
    const usuario = userEvent.setup();
    const esquema = z.object({ email: z.email('Informe um e-mail válido') });
    const aoEnviar = vi.fn();

    function Formulario() {
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm({ resolver: zodResolver(esquema), defaultValues: { email: '' } });
      return (
        <form onSubmit={handleSubmit(aoEnviar)} noValidate>
          <CampoTexto rotulo="E-mail" type="email" erro={errors.email?.message} {...register('email')} />
          <button type="submit">Entrar</button>
        </form>
      );
    }

    render(<Formulario />);
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    const campo = screen.getByRole('textbox', { name: 'E-mail' });
    expect(campo).toHaveFocus();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Informe um e-mail válido');

    await usuario.type(campo, 'ana@empresa.com.br');
    await usuario.keyboard('{Enter}');
    expect(aoEnviar).toHaveBeenCalledWith({ email: 'ana@empresa.com.br' }, expect.anything());
  });

  it('a ref aponta para o input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoTexto ref={ref} rotulo="E-mail" />);
    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'E-mail' }));
  });
});

describe('Rotulo e MensagemCampo', () => {
  it('compõem um campo próprio', () => {
    render(
      <div>
        <Rotulo htmlFor="periodo">Período</Rotulo>
        <input id="periodo" aria-describedby="periodo-erro" />
        <MensagemCampo id="periodo-erro" tipo="erro">
          A data final vem antes da inicial. Ajuste o período.
        </MensagemCampo>
      </div>,
    );
    expect(screen.getByRole('textbox', { name: 'Período' })).toHaveAccessibleDescription(
      'A data final vem antes da inicial. Ajuste o período.',
    );
  });

  it('a mensagem é dica por padrão, sem ícone', () => {
    render(<MensagemCampo>Mínimo de 12 caracteres</MensagemCampo>);
    const mensagem = screen.getByText('Mínimo de 12 caracteres').closest('p');
    expect(mensagem).toHaveClass('fc-mensagem-campo-dica', 'fc-texto-terciario');
    expect(mensagem?.querySelector('svg')).toBeNull();
  });
});
