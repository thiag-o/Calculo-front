import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Selo, Status, type CorSelo, type CorStatus } from '.';

afterEach(cleanup);

describe('Status (ponto + palavra)', () => {
  it('a palavra é o conteúdo lido; o ponto é decorativo', () => {
    const { container } = render(<Status cor="vermelho">Com erros</Status>);
    expect(container).toHaveTextContent(/^Com erros$/);
    const ponto = container.querySelector('.fc-status-ponto');
    expect(ponto).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Com erros')).toBeVisible();
  });

  it.each(['cinza', 'ambar', 'verde', 'vermelho', 'decisao', 'multiplo'] satisfies CorStatus[])('cor %s', (cor) => {
    const { container } = render(<Status cor={cor}>Entregue</Status>);
    expect(container.firstElementChild).toHaveClass('fc-status', `fc-status-${cor}`);
  });

  it('pulsa só quando pedido (Calculando, Na fila)', () => {
    const { container, rerender } = render(<Status cor="ambar">Aguardando fonte</Status>);
    expect(container.firstElementChild).not.toHaveClass('fc-status-pulsando');
    rerender(
      <Status cor="ambar" pulsando>
        Calculando
      </Status>,
    );
    expect(container.firstElementChild).toHaveClass('fc-status-pulsando');
  });

  it('repassa atributos, como um título com o estado técnico', () => {
    render(
      <Status cor="verde" title="CONCLUÍDA" className="fc-coluna-status">
        Entregue
      </Status>,
    );
    const status = screen.getByTitle('CONCLUÍDA');
    expect(status).toHaveClass('fc-status', 'fc-coluna-status');
  });
});

describe('Selo', () => {
  it('é cinza por padrão e mostra o texto', () => {
    render(<Selo>Rascunho</Selo>);
    expect(screen.getByText('Rascunho')).toHaveClass('fc-selo', 'fc-selo-cinza');
  });

  it.each(['cinza', 'azul', 'verde', 'ambar', 'vermelho'] satisfies CorSelo[])('cor %s', (cor) => {
    render(<Selo cor={cor}>1 teste falhando</Selo>);
    expect(screen.getByText('1 teste falhando')).toHaveClass(`fc-selo-${cor}`);
  });

  it('não tem ponto (o ponto é só do status)', () => {
    const { container } = render(<Selo cor="azul">Em revisão</Selo>);
    expect(container.querySelector('.fc-status-ponto')).toBeNull();
  });
});
