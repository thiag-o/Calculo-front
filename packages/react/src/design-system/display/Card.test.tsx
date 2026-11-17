import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '.';

afterEach(cleanup);

describe('Caixa', () => {
  it('é uma div com o conteúdo, com espaço interno por padrão', () => {
    render(<Card>Versão em produção</Card>);
    const checkbox = screen.getByText('Versão em produção');
    expect(checkbox.tagName).toBe('DIV');
    expect(checkbox).toHaveClass('fc-card');
    expect(checkbox).not.toHaveClass('fc-card-no-padding');
  });

  it('escolhe o elemento e mantém a semântica (section com título)', () => {
    render(
      <Card as="section" aria-labelledby="executions-title">
        <h2 id="executions-title">Execuções</h2>
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Execuções' })).toHaveClass('fc-card');
  });

  it('sem espaço, para listas e tabelas', () => {
    render(
      <Card padding="none" data-testid="card" className="fc-executions-list">
        lista
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('fc-card', 'fc-card-no-padding', 'fc-executions-list');
  });
});
