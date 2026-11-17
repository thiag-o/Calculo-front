import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Notice, EmptyState, Status, Table, type TableColumn, type TableProps } from '.';

afterEach(cleanup);

interface Execution {
  id: string;
  status: 'Entregue' | 'Com erros';
  duration: string;
  dots: string | null;
}

const executions: Execution[] = [
  { id: 'r_1114_002', status: 'Com erros', duration: '4m 12s', dots: '9.842' },
  { id: 'r_1101_001', status: 'Entregue', duration: '3m 58s', dots: null },
];

const columns: TableColumn<Execution>[] = [
  { key: 'id', title: 'Execução', cell: (row) => row.id },
  {
    key: 'status',
    title: 'Status',
    cell: (row) => <Status tone={row.status === 'Entregue' ? 'green' : 'red'}>{row.status}</Status>,
  },
  { key: 'points', title: 'Pontos', align: 'end', cell: (row) => row.dots },
  { key: 'actions', title: 'Ações', hiddenTitle: true, width: '48px', cell: () => <button type="button">…</button> },
];

const empty = <EmptyState title="Nenhuma execução ainda" description="Publique uma versão e execute o primeiro lote." />;

function renderScreen(props: Partial<TableProps<Execution>> = {}) {
  return render(
    <Table<Execution>
      caption="Execuções recentes"
      columns={columns}
      rows={executions}
      rowKey={(row) => row.id}
      empty={empty}
      {...props}
    />,
  );
}

describe('Tabela', () => {
  it('é uma tabela com nome, cabeçalhos de coluna e uma linha por item', () => {
    renderScreen();
    const table = screen.getByRole('table', { name: 'Execuções recentes' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Execução', 'Status', 'Pontos', 'Ações']);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'r_1114_002',
      'Com erros',
      '9.842',
      '…',
    ]);
  });

  it('a legenda e o título oculto só aparecem para o leitor de tela', () => {
    renderScreen();
    expect(screen.getByText('Execuções recentes')).toHaveClass('fc-visually-hidden');
    expect(screen.getByText('Ações')).toHaveClass('fc-visually-hidden');
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toHaveStyle({ width: '48px' });
  });

  it('valor vazio vira "—"', () => {
    renderScreen();
    const row = screen.getAllByRole('row')[2] as HTMLElement;
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('—');
  });

  it('alinha números ao fim', () => {
    renderScreen();
    expect(screen.getByRole('columnheader', { name: 'Pontos' })).toHaveClass('fc-table-end');
    expect(screen.getByRole('cell', { name: '9.842' })).toHaveClass('fc-table-end');
  });

  it('vazio: mostra o estado vazio numa célula que ocupa a largura toda', () => {
    renderScreen({ rows: [] });
    const cell = screen.getByText('Nenhuma execução ainda').closest('td');
    expect(cell).toHaveAttribute('colspan', '4');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('linhas indefinidas e sem carregar também contam como vazio', () => {
    renderScreen({ rows: undefined });
    expect(screen.getByText('Nenhuma execução ainda')).toBeInTheDocument();
  });

  it('carregando: esqueleto no lugar das linhas, tabela ocupada e anúncio para o leitor de tela', () => {
    const { container } = renderScreen({ loading: true, rows: undefined, loadingRows: 4 });
    const table = screen.getByRole('table', { name: 'Execuções recentes' });
    expect(table).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando execuções recentes');
    const skeleton = container.querySelectorAll('tbody tr');
    expect(skeleton).toHaveLength(4);
    skeleton.forEach((row) => expect(row).toHaveAttribute('aria-hidden', 'true'));
    expect(container.querySelectorAll('tbody .fc-skeleton')).toHaveLength(16);
    expect(screen.queryByText('Nenhuma execução ainda')).toBeNull();
    expect(screen.queryByText('r_1114_002')).toBeNull();
  });

  it('ao terminar de carregar, o anúncio some e as linhas aparecem', () => {
    const { rerender } = renderScreen({ loading: true });
    const announcement = screen.getByRole('status');
    rerender(
      <Table<Execution> caption="Execuções recentes" columns={columns} rows={executions} rowKey={(row) => row.id} empty={empty} />,
    );
    expect(announcement).toBeEmptyDOMElement();
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-busy');
    expect(screen.getByText('r_1114_002')).toBeInTheDocument();
  });

  it('erro: mostra o erro no lugar das linhas e do vazio', () => {
    renderScreen({
      rows: [],
      error: <Notice type="error">Não foi possível carregar as execuções. Tente de novo em instantes.</Notice>,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as execuções');
    expect(screen.getByRole('alert').closest('td')).toHaveAttribute('colspan', '4');
    expect(screen.queryByText('Nenhuma execução ainda')).toBeNull();
  });

  it('carregando vence o erro (nova tentativa em andamento)', () => {
    renderScreen({ loading: true, error: <Notice type="error">Falhou</Notice> });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });
});
