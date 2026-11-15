import '@testing-library/jest-dom/vitest';
import './jsdom.test.apoio';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaizFluxo } from '../raiz';
import { Botao, type ExibicaoMotivo } from '.';

afterEach(cleanup);

const motivo = 'Resolva 1 problema e 1 teste para enviar';

function IconeTeste() {
  return <svg data-testid="icone" aria-hidden="true" />;
}

describe('Botao', () => {
  it('é um botão com o texto como nome, do tipo button por padrão', () => {
    render(<Botao variante="principal">Abrir editor</Botao>);
    const botao = screen.getByRole('button', { name: 'Abrir editor' });
    expect(botao).toHaveAttribute('type', 'button');
    expect(botao).not.toHaveAttribute('aria-disabled');
  });

  it.each([
    ['principal', 'fc-botao-principal'],
    ['secundario', 'fc-botao-secundario'],
    ['fantasma', 'fc-botao-fantasma'],
    ['perigo', 'fc-botao-perigo'],
  ] as const)('variante %s', (variante, classe) => {
    render(<Botao variante={variante}>Executar lote</Botao>);
    expect(screen.getByRole('button')).toHaveClass('fc-botao', classe);
  });

  it('é secundário e de 32px por padrão; aceita pequeno e grande', () => {
    const { rerender } = render(<Botao>Simular</Botao>);
    expect(screen.getByRole('button')).toHaveClass('fc-botao-secundario');
    expect(screen.getByRole('button')).not.toHaveClass('fc-botao-pequeno', 'fc-botao-grande');
    rerender(<Botao tamanho="pequeno">Simular</Botao>);
    expect(screen.getByRole('button')).toHaveClass('fc-botao-pequeno');
    rerender(<Botao tamanho="grande">Simular</Botao>);
    expect(screen.getByRole('button')).toHaveClass('fc-botao-grande');
  });

  it('aciona pelo clique, pelo Enter e pelo Espaço', async () => {
    const usuario = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Executar lote</Botao>);
    await usuario.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await usuario.keyboard('{Enter}');
    await usuario.keyboard(' ');
    expect(aoClicar).toHaveBeenCalledTimes(3);
  });

  it('recebe o foco pelo Tab', async () => {
    const usuario = userEvent.setup();
    render(<Botao>Executar lote</Botao>);
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toHaveFocus();
  });

  it('repassa a ref, o id e atributos aria', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Botao ref={ref} id="enviar" aria-describedby="ajuda-externa">
        Enviar para revisão
      </Botao>,
    );
    expect(ref.current).toBe(screen.getByRole('button'));
    expect(ref.current).toHaveAttribute('id', 'enviar');
    expect(ref.current).toHaveAttribute('aria-describedby', 'ajuda-externa');
  });

  it('mostra o ícone antes do texto', () => {
    render(<Botao icone={<IconeTeste />}>Rodar testes</Botao>);
    const botao = screen.getByRole('button', { name: 'Rodar testes' });
    expect(botao.firstElementChild).toBe(screen.getByTestId('icone'));
  });
});

describe('Botao desabilitado com motivo', () => {
  function renderizar(props: { exibirMotivo?: ExibicaoMotivo } = {}) {
    const aoClicar = vi.fn();
    const aoEnviar = vi.fn((evento: { preventDefault(): void }) => evento.preventDefault());
    render(
      <RaizFluxo>
        <form onSubmit={aoEnviar}>
          <input aria-label="Mensagem da versão" />
          <Botao variante="principal" type="submit" motivoDesabilitado={motivo} onClick={aoClicar} {...props}>
            Enviar para revisão
          </Botao>
        </form>
      </RaizFluxo>,
    );
    return { aoClicar, aoEnviar, botao: screen.getByRole('button', { name: 'Enviar para revisão' }) };
  }

  it('fica com aria-disabled e o motivo como descrição acessível', () => {
    const { botao } = renderizar();
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    expect(botao).toHaveAccessibleDescription(motivo);
    expect(botao).toHaveClass('fc-botao-desabilitado');
  });

  it('continua focável pelo teclado, para o motivo ser lido', async () => {
    const usuario = userEvent.setup();
    const { botao } = renderizar();
    await usuario.tab();
    await usuario.tab();
    expect(botao).toHaveFocus();
  });

  it('não aciona nem envia o formulário pelo clique, Enter, Espaço ou Enter no campo', async () => {
    const usuario = userEvent.setup();
    const { aoClicar, aoEnviar, botao } = renderizar();
    await usuario.click(botao);
    botao.focus();
    await usuario.keyboard('{Enter}');
    await usuario.keyboard(' ');
    await usuario.click(screen.getByRole('textbox', { name: 'Mensagem da versão' }));
    await usuario.keyboard('{Enter}');
    expect(aoClicar).not.toHaveBeenCalled();
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('mostra o motivo na dica ao receber o foco, dentro da raiz do módulo, e Esc fecha', async () => {
    const usuario = userEvent.setup();
    const { botao } = renderizar();
    await usuario.tab();
    await usuario.tab();
    expect(botao).toHaveFocus();
    const dica = await screen.findByRole('tooltip');
    expect(dica).toHaveTextContent(motivo);
    expect(dica.closest('.fc-portais')).not.toBeNull();
    // A descrição não duplica com a dica aberta.
    expect(botao).toHaveAccessibleDescription(motivo);
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(botao).toHaveFocus();
  });

  it('mostra o motivo na dica ao passar o mouse', async () => {
    const usuario = userEvent.setup();
    const { botao } = renderizar();
    await usuario.hover(botao);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(motivo);
    await usuario.unhover(botao);
  });

  it('com o motivo ao lado: texto visível ligado por aria-describedby, sem dica', async () => {
    const usuario = userEvent.setup();
    const { botao } = renderizar({ exibirMotivo: 'ao-lado' });
    const texto = screen.getByText(motivo);
    expect(texto).toBeVisible();
    expect(botao).toHaveAccessibleDescription(motivo);
    expect(texto).toHaveClass('fc-label-12', 'fc-texto-terciario');
    botao.focus();
    await usuario.hover(botao);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('volta a funcionar quando o motivo some', async () => {
    const usuario = userEvent.setup();
    const aoClicar = vi.fn();
    const { rerender } = render(
      <RaizFluxo>
        <Botao motivoDesabilitado={motivo} onClick={aoClicar}>
          Enviar para revisão
        </Botao>
      </RaizFluxo>,
    );
    rerender(
      <RaizFluxo>
        <Botao motivoDesabilitado={undefined} onClick={aoClicar}>
          Enviar para revisão
        </Botao>
      </RaizFluxo>,
    );
    const botao = screen.getByRole('button', { name: 'Enviar para revisão' });
    expect(botao).not.toHaveAttribute('aria-disabled');
    expect(botao).not.toHaveAttribute('aria-describedby');
    await usuario.click(botao);
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });
});

describe('Botao carregando', () => {
  it('marca aria-busy, troca o ícone pelo indicador e ignora cliques', async () => {
    const usuario = userEvent.setup();
    const aoClicar = vi.fn();
    render(
      <Botao variante="principal" carregando icone={<IconeTeste />} onClick={aoClicar}>
        Entrar
      </Botao>,
    );
    const botao = screen.getByRole('button', { name: 'Entrar' });
    expect(botao).toHaveAttribute('aria-busy', 'true');
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByTestId('icone')).toBeNull();
    expect(botao.querySelector('.fc-botao-girando')).not.toBeNull();
    await usuario.click(botao);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('não perde o foco ao começar a carregar', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<Botao type="submit">Entrar</Botao>);
    await usuario.tab();
    rerender(
      <Botao type="submit" carregando>
        Entrar
      </Botao>,
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus();
  });

  it('não envia o formulário enquanto carrega', async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn((evento: { preventDefault(): void }) => evento.preventDefault());
    render(
      <form onSubmit={aoEnviar}>
        <Botao type="submit" carregando>
          Entrar
        </Botao>
      </form>,
    );
    await usuario.click(screen.getByRole('button'));
    expect(aoEnviar).not.toHaveBeenCalled();
  });
});

describe('Botao só ícone', () => {
  it('é quadrado, usa o rótulo como nome acessível e mostra o nome na dica', async () => {
    const usuario = userEvent.setup();
    render(
      <RaizFluxo>
        <Botao soIcone rotulo="Mais ações" icone={<IconeTeste />} />
      </RaizFluxo>,
    );
    const botao = screen.getByRole('button', { name: 'Mais ações' });
    expect(botao).toHaveClass('fc-botao-so-icone');
    expect(botao.querySelector('.fc-botao-texto')).toBeNull();
    expect(botao).not.toHaveAttribute('aria-describedby');
    await usuario.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Mais ações');
  });

  it('desabilitado, mostra o nome e o motivo na dica', async () => {
    const usuario = userEvent.setup();
    render(
      <RaizFluxo>
        <Botao soIcone rotulo="Excluir conexão" icone={<IconeTeste />} variante="fantasma" motivoDesabilitado="Conexão em uso por 2 workflows" />
      </RaizFluxo>,
    );
    const botao = screen.getByRole('button', { name: 'Excluir conexão' });
    expect(botao).toHaveAccessibleDescription('Conexão em uso por 2 workflows');
    await usuario.tab();
    const dica = await screen.findByRole('tooltip');
    expect(dica).toHaveTextContent('Excluir conexão');
    expect(dica).toHaveTextContent('Conexão em uso por 2 workflows');
  });
});
