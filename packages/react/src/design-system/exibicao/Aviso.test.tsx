import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao } from '../formulario';
import { RaizFluxo } from '../raiz';
import { Aviso } from '.';

afterEach(cleanup);

const erro = 'Não foi possível ler ItensNF.vl_itm: a coluna não existe mais na origem.';

describe('Aviso', () => {
  it('erro é um alerta, anunciado na hora', () => {
    render(<Aviso tipo="erro">{erro}</Aviso>);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(erro);
    expect(alerta).toHaveClass('fc-aviso', 'fc-aviso-erro');
  });

  it.each(['sucesso', 'atencao'] as const)('%s é um status, sem interromper o leitor de tela', (tipo) => {
    render(<Aviso tipo={tipo}>Versão publicada</Aviso>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveClass(`fc-aviso-${tipo}`);
  });

  it('tem um ícone decorativo por tipo', () => {
    const { container } = render(<Aviso tipo="atencao">1 teste falhando</Aviso>);
    const icone = container.querySelector('svg');
    expect(icone).toHaveAttribute('aria-hidden', 'true');
    expect(icone).toHaveAttribute('width', '14');
  });

  it('mostra o título antes do texto', () => {
    render(
      <Aviso tipo="erro" titulo="Falha na conexão">
        {erro}
      </Aviso>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(`Falha na conexão${erro}`);
  });

  it('mostra as ações para resolver, fora da nota, e elas funcionam pelo teclado', async () => {
    const usuario = userEvent.setup();
    const tentar = vi.fn();
    render(
      <RaizFluxo>
        <Aviso
          tipo="erro"
          className="fc-erro-catalogo"
          acoes={
            <>
              <Botao tamanho="pequeno">Abrir catálogo</Botao>
              <Botao tamanho="pequeno" variante="fantasma" onClick={tentar}>
                Tentar de novo
              </Botao>
            </>
          }
        >
          {erro}
        </Aviso>
      </RaizFluxo>,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).not.toContainElement(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(alerta.parentElement).toHaveClass('fc-aviso-bloco', 'fc-erro-catalogo');
    await usuario.tab();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toHaveFocus();
    await usuario.keyboard(' ');
    expect(tentar).toHaveBeenCalledTimes(1);
  });
});
