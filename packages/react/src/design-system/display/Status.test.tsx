import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge, Status, type BadgeTone, type StatusTone } from '.';

afterEach(cleanup);

describe('Status (ponto + palavra)', () => {
  it('a palavra é o conteúdo lido; o ponto é decorativo', () => {
    const { container } = render(<Status tone="red">Com erros</Status>);
    expect(container).toHaveTextContent(/^Com erros$/);
    const dot = container.querySelector('.fc-status-dot');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Com erros')).toBeVisible();
  });

  it.each(['gray', 'amber', 'green', 'red', 'decision', 'multi'] satisfies StatusTone[])('cor %s', (color) => {
    const { container } = render(<Status tone={color}>Entregue</Status>);
    expect(container.firstElementChild).toHaveClass('fc-status', `fc-status-${color}`);
  });

  it('pulsa só quando pedido (Calculando, Na fila)', () => {
    const { container, rerender } = render(<Status tone="amber">Aguardando fonte</Status>);
    expect(container.firstElementChild).not.toHaveClass('fc-status-pulsing');
    rerender(
      <Status tone="amber" pulsing>
        Calculando
      </Status>,
    );
    expect(container.firstElementChild).toHaveClass('fc-status-pulsing');
  });

  it('repassa atributos, como um título com o estado técnico', () => {
    render(
      <Status tone="green" title="CONCLUÍDA" className="fc-status-column">
        Entregue
      </Status>,
    );
    const status = screen.getByTitle('CONCLUÍDA');
    expect(status).toHaveClass('fc-status', 'fc-status-column');
  });
});

describe('Selo', () => {
  it('é cinza por padrão e mostra o texto', () => {
    render(<Badge>Rascunho</Badge>);
    expect(screen.getByText('Rascunho')).toHaveClass('fc-badge', 'fc-badge-gray');
  });

  it.each(['gray', 'blue', 'green', 'amber', 'red'] satisfies BadgeTone[])('cor %s', (color) => {
    render(<Badge tone={color}>1 teste falhando</Badge>);
    expect(screen.getByText('1 teste falhando')).toHaveClass(`fc-badge-${color}`);
  });

  it('não tem ponto (o ponto é só do status)', () => {
    const { container } = render(<Badge tone="blue">Em revisão</Badge>);
    expect(container.querySelector('.fc-status-dot')).toBeNull();
  });
});
