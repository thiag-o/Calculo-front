import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../../design-system';
import { DRAFT, RUN_OK } from './unit-run.test-support';
import { UnitRunResult } from './UnitRunResult';

afterEach(cleanup);

describe('Resultado do Calcular fora do editor (gaveta do trace da execução)', () => {
  it('mostra o nome dos blocos e os números no padrão brasileiro, sem seleção no canvas', () => {
    render(
      <FluxoRoot>
        <UnitRunResult run={RUN_OK} definition={DRAFT.definition} />
      </FluxoRoot>,
    );

    const blocks = screen.getByRole('region', { name: 'Blocos' });
    expect(within(blocks).getByText('Pontos')).toBeInTheDocument();
    expect(within(blocks).getByText('Elegibilidade')).toBeInTheDocument();
    expect(within(blocks).getByText('1.225,50')).toBeInTheDocument();
    expect(within(blocks).getByText('0,1500')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Saídas' })).getByText('1.225,50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /selecionar no canvas/ })).not.toBeInTheDocument();
  });

  it('com a definição atual e o onSelectNode (o editor), o bloco continua selecionável', () => {
    const onSelectNode = vi.fn();
    render(
      <FluxoRoot>
        <UnitRunResult run={RUN_OK} definition={DRAFT.definition} currentDefinition={DRAFT.definition} onSelectNode={onSelectNode} />
      </FluxoRoot>,
    );
    expect(screen.getByRole('button', { name: 'Pontos: selecionar no canvas' })).toBeInTheDocument();
  });
});
