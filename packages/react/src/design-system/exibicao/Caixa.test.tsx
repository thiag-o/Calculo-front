import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Caixa } from '.';

afterEach(cleanup);

describe('Caixa', () => {
  it('é uma div com o conteúdo, com espaço interno por padrão', () => {
    render(<Caixa>Versão em produção</Caixa>);
    const caixa = screen.getByText('Versão em produção');
    expect(caixa.tagName).toBe('DIV');
    expect(caixa).toHaveClass('fc-caixa');
    expect(caixa).not.toHaveClass('fc-caixa-sem-espaco');
  });

  it('escolhe o elemento e mantém a semântica (section com título)', () => {
    render(
      <Caixa como="section" aria-labelledby="titulo-execucoes">
        <h2 id="titulo-execucoes">Execuções</h2>
      </Caixa>,
    );
    expect(screen.getByRole('region', { name: 'Execuções' })).toHaveClass('fc-caixa');
  });

  it('sem espaço, para listas e tabelas', () => {
    render(
      <Caixa espaco="nenhum" data-testid="caixa" className="fc-lista-execucoes">
        lista
      </Caixa>,
    );
    expect(screen.getByTestId('caixa')).toHaveClass('fc-caixa', 'fc-caixa-sem-espaco', 'fc-lista-execucoes');
  });
});
