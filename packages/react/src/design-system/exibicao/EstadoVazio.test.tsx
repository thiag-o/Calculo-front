import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao } from '../formulario';
import { RaizFluxo } from '../raiz';
import { EstadoVazio } from '.';

afterEach(cleanup);

describe('EstadoVazio', () => {
  it('mostra a frase, a ajuda e uma ação que funciona', async () => {
    const usuario = userEvent.setup();
    const aoExecutar = vi.fn();
    render(
      <RaizFluxo>
        <EstadoVazio
          titulo="Nenhuma execução ainda"
          descricao="Publique uma versão e execute o primeiro lote."
          acao={
            <Botao tamanho="pequeno" onClick={aoExecutar}>
              Executar lote
            </Botao>
          }
        />
      </RaizFluxo>,
    );
    expect(screen.getByText('Nenhuma execução ainda')).toBeVisible();
    expect(screen.getByText('Publique uma versão e execute o primeiro lote.')).toHaveClass('fc-label-13', 'fc-texto-secundario');
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(aoExecutar).toHaveBeenCalledTimes(1);
  });

  it('o ícone é decorativo e tem um padrão', () => {
    const { container } = render(<EstadoVazio titulo="Nenhum workflow" />);
    const icone = container.querySelector('.fc-estado-vazio-icone');
    expect(icone).toHaveAttribute('aria-hidden', 'true');
    expect(icone?.querySelector('svg')).not.toBeNull();
  });

  it('aceita outro ícone e funciona sem descrição e sem ação', () => {
    const { container } = render(<EstadoVazio titulo="Nenhum resultado" icone={<svg data-testid="lupa" />} />);
    expect(screen.getByTestId('lupa')).toBeInTheDocument();
    expect(container.querySelector('.fc-estado-vazio-acao')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
