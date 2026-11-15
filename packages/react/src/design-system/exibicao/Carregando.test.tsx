import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Carregando, Esqueleto } from '.';

afterEach(cleanup);

describe('Carregando', () => {
  it('é uma região de status com o rótulo para o leitor de tela', () => {
    render(<Carregando rotulo="Carregando execuções" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando execuções');
    expect(screen.getByText('Carregando execuções')).toHaveClass('fc-oculto-visualmente');
  });

  it('usa "Carregando" quando não há rótulo', () => {
    render(<Carregando />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('desenha 3 linhas de barras por padrão, ocultas para o leitor de tela', () => {
    const { container } = render(<Carregando />);
    const forma = container.querySelector('.fc-carregando-forma');
    expect(forma).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.fc-carregando-linha')).toHaveLength(3);
    expect(container.querySelectorAll('.fc-esqueleto')).toHaveLength(9);
  });

  it('aceita o número de linhas', () => {
    const { container } = render(<Carregando linhas={5} />);
    expect(container.querySelectorAll('.fc-carregando-linha')).toHaveLength(5);
  });

  it('aceita uma forma própria, com a cara da lista final', () => {
    const { container } = render(
      <Carregando rotulo="Carregando workflows">
        <Esqueleto largura={160} />
        <Esqueleto largura="40%" />
      </Carregando>,
    );
    const barras = container.querySelectorAll<HTMLElement>('.fc-esqueleto');
    expect(barras).toHaveLength(2);
    expect(barras[0]?.style.width).toBe('160px');
    expect(barras[1]?.style.width).toBe('40%');
    expect(container.querySelector('.fc-carregando-linha')).toBeNull();
  });
});

describe('Esqueleto', () => {
  it('é decorativo e ocupa o espaço livre sem largura', () => {
    const { container } = render(<Esqueleto />);
    const barra = container.firstElementChild as HTMLElement;
    expect(barra).toHaveAttribute('aria-hidden', 'true');
    expect(barra.style.flex).toMatch(/^1 1 0/);
  });
});
