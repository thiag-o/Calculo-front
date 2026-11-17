import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FluxoRoot, Notice } from '../../design-system';
import { ColumnsTable, DATA_TYPE_LABELS, UNSUPPORTED_COLUMNS_NOTE, columnTypeLabel, dataTypeLabel, type Column } from '.';

afterEach(cleanup);

const COLUMNS: Column[] = [
  { name: 'id', source_type: 'bigint', type: 'integer', scale: null, nullable: false },
  { name: 'valor', source_type: 'numeric(12,2)', type: 'decimal', scale: 2, nullable: true },
  { name: 'geom', source_type: 'geometry', type: null, scale: null, nullable: true },
];

function renderTable(props: Partial<Parameters<typeof ColumnsTable>[0]> = {}) {
  render(
    <FluxoRoot theme="light">
      <ColumnsTable caption="Colunas de public.vendas" columns={COLUMNS} {...props} />
    </FluxoRoot>,
  );
  return screen.getByRole('table', { name: 'Colunas de public.vendas' });
}

describe('Rótulos de DataType', () => {
  it('dá um nome em português a cada tipo', () => {
    expect(DATA_TYPE_LABELS).toEqual({
      text: 'Texto',
      integer: 'Inteiro',
      decimal: 'Decimal',
      date: 'Data',
      datetime: 'Data e hora',
      boolean: 'Booleano',
    });
  });

  it('mostra as casas só no decimal', () => {
    expect(dataTypeLabel('decimal', 2)).toBe('Decimal (2 casas)');
    expect(dataTypeLabel('decimal', 1)).toBe('Decimal (1 casa)');
    expect(dataTypeLabel('decimal', null)).toBe('Decimal');
    expect(dataTypeLabel('integer', 2)).toBe('Inteiro');
    expect(columnTypeLabel({ type: null, scale: null })).toBeUndefined();
  });
});

describe('Tabela de colunas', () => {
  it('mostra nome, tipo de origem, tipo e anulável', () => {
    const table = renderTable();
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Nome',
      'Tipo de origem',
      'Tipo',
      'Anulável',
    ]);
    const row = within(table).getByRole('row', { name: /valor/ });
    expect(within(row).getByText('numeric(12,2)')).toBeInTheDocument();
    expect(within(row).getByText('Decimal (2 casas)')).toBeInTheDocument();
    expect(within(row).getByText('Sim')).toBeInTheDocument();
    expect(within(within(table).getByRole('row', { name: /bigint/ })).getByText('Não')).toBeInTheDocument();
  });

  it('coluna sem tipo correspondente aparece como sem suporte, com a nota abaixo', () => {
    const table = renderTable();
    expect(within(within(table).getByRole('row', { name: /geom/ })).getByText('Sem suporte')).toBeInTheDocument();
    expect(screen.getByText(UNSUPPORTED_COLUMNS_NOTE)).toBeInTheDocument();
  });

  it('sem colunas sem suporte, não mostra a nota', () => {
    renderTable({ columns: COLUMNS.slice(0, 2) });
    expect(screen.queryByText(UNSUPPORTED_COLUMNS_NOTE)).not.toBeInTheDocument();
  });

  it('mostra o carregamento, o vazio e o erro', () => {
    const loading = renderTable({ columns: undefined, loading: true });
    expect(loading).toHaveAttribute('aria-busy', 'true');
    cleanup();

    renderTable({ columns: [] });
    expect(screen.getByText('Nenhuma coluna')).toBeInTheDocument();
    cleanup();

    renderTable({ columns: undefined, error: <Notice type="error">Não foi possível ler as colunas</Notice> });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível ler as colunas');
    expect(screen.queryByText(UNSUPPORTED_COLUMNS_NOTE)).not.toBeInTheDocument();
  });

  it('mostra colunas com o mesmo nome (SQL com nomes repetidos)', () => {
    const table = renderTable({
      columns: [
        { name: 'id', source_type: 'int', type: 'integer', scale: null, nullable: false },
        { name: 'id', source_type: 'varchar(10)', type: 'text', scale: null, nullable: true },
      ],
    });
    expect(within(table).getAllByRole('row', { name: /^id/ })).toHaveLength(2);
    expect(within(table).getByText('varchar(10)')).toBeInTheDocument();
    expect(within(table).getByText('int')).toBeInTheDocument();
  });

  it('aceita colunas a mais depois das quatro', () => {
    const table = renderTable({ extraColumns: [{ key: 'variable', title: 'Variável', cell: (column) => `var_${column.name}` }] });
    expect(within(table).getAllByRole('columnheader').at(-1)).toHaveTextContent('Variável');
    expect(within(table).getByText('var_id')).toBeInTheDocument();
  });
});
