import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FluxoRoot } from '../design-system';
import { Home } from '.';

afterEach(cleanup);

function open() {
  return render(
    <FluxoRoot>
      <Home />
    </FluxoRoot>,
  );
}

describe('Inicio, sem dados', () => {
  it('mostra o título e as três seções', () => {
    open();
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    for (const name of ['Precisa de você', 'Workflows recentes', 'Execuções recentes']) {
      expect(screen.getByRole('region', { name: name })).toBeInTheDocument();
    }
  });

  it('cada seção mostra seu estado vazio', () => {
    open();
    const needs = screen.getByRole('region', { name: 'Precisa de você' });
    expect(within(needs).getByText('Nada precisa de você agora')).toBeInTheDocument();
    const workflows = screen.getByRole('region', { name: 'Workflows recentes' });
    expect(within(workflows).getByText('Nenhum workflow ainda')).toBeInTheDocument();
    const executions = screen.getByRole('region', { name: 'Execuções recentes' });
    expect(within(executions).getByText('Nenhuma execução ainda')).toBeInTheDocument();
    expect(within(executions).getByText('Publique uma versão e execute o primeiro lote.')).toBeInTheDocument();
  });

  it('as ações indisponíveis dizem o motivo e não agem', () => {
    open();
    const executions = screen.getByRole('region', { name: 'Execuções recentes' });
    const run = within(executions).getByRole('button', { name: 'Executar lote' });
    expect(run).toHaveAttribute('aria-disabled', 'true');
    expect(run).toHaveAccessibleDescription('Disponível quando houver um workflow publicado');
    for (const button of screen.getAllByRole('button', { name: 'Novo workflow' })) {
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription(/Disponível quando os workflows chegarem/);
    }
  });
});
