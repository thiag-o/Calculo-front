import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Loading, Skeleton } from '.';

afterEach(cleanup);

describe('Carregando', () => {
  it('é uma região de status com o rótulo para o leitor de tela', () => {
    render(<Loading label="Carregando execuções" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando execuções');
    expect(screen.getByText('Carregando execuções')).toHaveClass('fc-visually-hidden');
  });

  it('usa "Carregando" quando não há rótulo', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('desenha 3 linhas de barras por padrão, ocultas para o leitor de tela', () => {
    const { container } = render(<Loading />);
    const shape = container.querySelector('.fc-loading-shape');
    expect(shape).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.fc-loading-row')).toHaveLength(3);
    expect(container.querySelectorAll('.fc-skeleton')).toHaveLength(9);
  });

  it('aceita o número de linhas', () => {
    const { container } = render(<Loading rows={5} />);
    expect(container.querySelectorAll('.fc-loading-row')).toHaveLength(5);
  });

  it('aceita uma forma própria, com a cara da lista final', () => {
    const { container } = render(
      <Loading label="Carregando workflows">
        <Skeleton width={160} />
        <Skeleton width="40%" />
      </Loading>,
    );
    const bars = container.querySelectorAll<HTMLElement>('.fc-skeleton');
    expect(bars).toHaveLength(2);
    expect(bars[0]?.style.width).toBe('160px');
    expect(bars[1]?.style.width).toBe('40%');
    expect(container.querySelector('.fc-loading-row')).toBeNull();
  });
});

describe('Esqueleto', () => {
  it('é decorativo e ocupa o espaço livre sem largura', () => {
    const { container } = render(<Skeleton />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar.style.flex).toMatch(/^1 1 0/);
  });
});
