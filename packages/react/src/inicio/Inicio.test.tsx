import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RaizFluxo } from '../design-system';
import { Inicio } from '.';

afterEach(cleanup);

function abrir() {
  return render(
    <RaizFluxo>
      <Inicio />
    </RaizFluxo>,
  );
}

describe('Inicio, sem dados', () => {
  it('mostra o título e as três seções', () => {
    abrir();
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    for (const nome of ['Precisa de você', 'Workflows recentes', 'Execuções recentes']) {
      expect(screen.getByRole('region', { name: nome })).toBeInTheDocument();
    }
  });

  it('cada seção mostra seu estado vazio', () => {
    abrir();
    const precisa = screen.getByRole('region', { name: 'Precisa de você' });
    expect(within(precisa).getByText('Nada precisa de você agora')).toBeInTheDocument();
    const workflows = screen.getByRole('region', { name: 'Workflows recentes' });
    expect(within(workflows).getByText('Nenhum workflow ainda')).toBeInTheDocument();
    const execucoes = screen.getByRole('region', { name: 'Execuções recentes' });
    expect(within(execucoes).getByText('Nenhuma execução ainda')).toBeInTheDocument();
    expect(within(execucoes).getByText('Publique uma versão e execute o primeiro lote.')).toBeInTheDocument();
  });

  it('as ações indisponíveis dizem o motivo e não agem', () => {
    abrir();
    const execucoes = screen.getByRole('region', { name: 'Execuções recentes' });
    const executar = within(execucoes).getByRole('button', { name: 'Executar lote' });
    expect(executar).toHaveAttribute('aria-disabled', 'true');
    expect(executar).toHaveAccessibleDescription('Disponível quando houver um workflow publicado');
    for (const botao of screen.getAllByRole('button', { name: 'Novo workflow' })) {
      expect(botao).toHaveAttribute('aria-disabled', 'true');
      expect(botao).toHaveAccessibleDescription(/Disponível quando os workflows chegarem/);
    }
  });
});
