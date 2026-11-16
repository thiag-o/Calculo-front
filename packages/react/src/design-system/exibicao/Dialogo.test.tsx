import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao, CampoTexto } from '../formulario';
import { RaizFluxo } from '../raiz';
import { Dialogo, FecharDialogo, type DialogoProps } from '.';

afterEach(cleanup);

function DialogoDeAjuste({ aoAjustar = () => {} }: { aoAjustar?: () => void }) {
  return (
    <RaizFluxo>
      <Botao>Antes</Botao>
      <Dialogo
        titulo="Ajustar valor"
        descricao="O saldo muda na hora e o ajuste fica no extrato."
        gatilho={<Botao variante="principal">Ajustar valor</Botao>}
        acoes={
          <>
            <FecharDialogo>
              <Botao>Cancelar</Botao>
            </FecharDialogo>
            <Botao variante="perigo" onClick={aoAjustar}>
              Ajustar valor
            </Botao>
          </>
        }
      >
        <CampoTexto rotulo="Motivo" />
      </Dialogo>
    </RaizFluxo>
  );
}

async function abrir() {
  const usuario = userEvent.setup();
  render(<DialogoDeAjuste />);
  await usuario.click(screen.getByRole('button', { name: 'Ajustar valor' }));
  const dialogo = await screen.findByRole('dialog');
  return { usuario, dialogo };
}

describe('Dialogo', () => {
  it('fica fechado até o gatilho ser usado', () => {
    render(<DialogoDeAjuste />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre como diálogo modal, com o título como nome e a descrição', async () => {
    const { dialogo } = await abrir();
    expect(dialogo).toHaveAccessibleName('Ajustar valor');
    expect(dialogo).toHaveAccessibleDescription('O saldo muda na hora e o ajuste fica no extrato.');
    expect(screen.getByRole('heading', { name: 'Ajustar valor' })).toHaveClass('fc-heading-16');
  });

  it('o portal fica dentro da raiz do módulo, não no body', async () => {
    const usuario = userEvent.setup();
    render(<DialogoDeAjuste />);
    const gatilho = screen.getByRole('button', { name: 'Ajustar valor' });
    await usuario.click(gatilho);
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo.closest('.fc-portais')).not.toBeNull();
    expect(dialogo.closest('.fc-raiz')).not.toBeNull();
    expect(dialogo.parentElement).not.toBe(document.body);
    const fundo = document.querySelector('.fc-dialogo-fundo');
    expect(fundo?.closest('.fc-portais')).not.toBeNull();
    // A mesma raiz do gatilho (tema e fonte herdados), e nenhum filho novo no body.
    expect(dialogo.closest('.fc-raiz')).toBe(gatilho.closest('.fc-raiz'));
    expect(Array.from(document.body.children).filter((filho) => filho.contains(dialogo))).toHaveLength(1);
    expect(Array.from(document.body.children).find((filho) => filho.contains(dialogo))).toContainElement(gatilho);
  });

  it('abre com o foco no primeiro campo', async () => {
    await abrir();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveFocus());
  });

  it('prende o foco: Tab e Shift+Tab circulam só dentro do diálogo', async () => {
    const { usuario, dialogo } = await abrir();
    const campo = screen.getByRole('textbox', { name: 'Motivo' });
    await waitFor(() => expect(campo).toHaveFocus());
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getAllByRole('button', { name: 'Ajustar valor' }).at(-1)).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await usuario.tab();
    expect(campo).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
  });

  it('o resto do módulo fica oculto para o leitor de tela enquanto está aberto', async () => {
    await abrir();
    expect(screen.queryByRole('button', { name: 'Antes' })).toBeNull();
    const antes = screen.getByText('Antes').closest('button');
    expect(antes?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('Esc fecha e devolve o foco ao gatilho', async () => {
    const { usuario } = await abrir();
    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Ajustar valor' })).toHaveFocus();
  });

  it('"Fechar" e FecharDialogo fecham', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await usuario.click(screen.getByRole('button', { name: 'Ajustar valor' }));
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a ação do rodapé roda sem fechar sozinha', async () => {
    const aoAjustar = vi.fn();
    const usuario = userEvent.setup();
    render(<DialogoDeAjuste aoAjustar={aoAjustar} />);
    await usuario.click(screen.getByRole('button', { name: 'Ajustar valor' }));
    const botoes = await screen.findAllByRole('button', { name: 'Ajustar valor' });
    await usuario.click(botoes.at(-1) as HTMLElement);
    expect(aoAjustar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('controlado: abre e fecha pelo estado de quem usa', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    function Controlado() {
      const [aberto, setAberto] = useState(false);
      return (
        <RaizFluxo>
          <Botao onClick={() => setAberto(true)}>Excluir conexão</Botao>
          <Dialogo
            titulo="Excluir conexão"
            aberto={aberto}
            aoMudarAberto={(valor) => {
              aoMudar(valor);
              setAberto(valor);
            }}
          >
            <p>A conexão some de todos os workflows.</p>
          </Dialogo>
        </RaizFluxo>
      );
    }
    render(<Controlado />);
    await usuario.click(screen.getByRole('button', { name: 'Excluir conexão' }));
    const dialogo = await screen.findByRole('dialog');
    // Sem descrição, o diálogo não aponta para uma descrição inexistente.
    expect(dialogo).not.toHaveAttribute('aria-describedby');
    // Sem campos nem ações, o foco vai para o próprio diálogo, não para o "Fechar" (cuja dica abriria no foco).
    await waitFor(() => expect(dialogo).toHaveFocus());
    expect(screen.queryByRole('tooltip')).toBeNull();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    // Um Esc só fecha: o primeiro fecharia a dica do "Fechar"; o foco volta ao diálogo antes.
    dialogo.focus();
    await usuario.keyboard('{Escape}');
    expect(aoMudar).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('abertoInicial abre sem gatilho', async () => {
    render(
      <RaizFluxo>
        <Dialogo titulo="Sessão expirada" abertoInicial>
          <p>Entre de novo para continuar.</p>
        </Dialogo>
      </RaizFluxo>,
    );
    expect(await screen.findByRole('dialog', { name: 'Sessão expirada' })).toBeInTheDocument();
  });
});

// Abre por um botão que não é gatilho do Radix (como o item de um Menu) e informa onde o foco volta.
function DialogoComFocoInformado({ comFuncao = false }: { comFuncao?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const destino = useRef<HTMLButtonElement>(null);
  const foco: DialogoProps['focoAoFechar'] = comFuncao ? () => destino.current : destino;
  return (
    <RaizFluxo>
      <Botao onClick={() => setAberto(true)}>Abrir de fora</Botao>
      <Botao ref={destino}>Destino</Botao>
      <Dialogo
        aberto={aberto}
        aoMudarAberto={setAberto}
        titulo="Ajustar valor"
        focoAoFechar={foco}
        acoes={
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
        }
      >
        <CampoTexto rotulo="Motivo" />
      </Dialogo>
    </RaizFluxo>
  );
}

describe('Dialogo com focoAoFechar', () => {
  const formas = [
    ['referência', false],
    ['função', true],
  ] as const;
  const jeitos = [
    ['Esc', async (usuario: ReturnType<typeof userEvent.setup>) => usuario.keyboard('{Escape}')],
    ['o botão Fechar', async (usuario: ReturnType<typeof userEvent.setup>) => usuario.click(screen.getByRole('button', { name: 'Fechar' }))],
    ['Cancelar', async (usuario: ReturnType<typeof userEvent.setup>) => usuario.click(screen.getByRole('button', { name: 'Cancelar' }))],
  ] as const;

  for (const [forma, comFuncao] of formas) {
    for (const [jeito, fechar] of jeitos) {
      it(`devolve o foco ao elemento informado (${forma}) ao fechar por ${jeito}`, async () => {
        const usuario = userEvent.setup();
        render(<DialogoComFocoInformado comFuncao={comFuncao} />);
        await usuario.click(screen.getByRole('button', { name: 'Abrir de fora' }));
        await screen.findByRole('dialog');
        await fechar(usuario);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Destino' })).toHaveFocus());
      });
    }
  }
});
