import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Aviso, EstadoVazio, Status, Tabela, type ColunaTabela, type TabelaProps } from '.';

afterEach(cleanup);

interface Execucao {
  id: string;
  status: 'Entregue' | 'Com erros';
  duracao: string;
  pontos: string | null;
}

const execucoes: Execucao[] = [
  { id: 'r_1114_002', status: 'Com erros', duracao: '4m 12s', pontos: '9.842' },
  { id: 'r_1101_001', status: 'Entregue', duracao: '3m 58s', pontos: null },
];

const colunas: ColunaTabela<Execucao>[] = [
  { chave: 'id', titulo: 'Execução', celula: (linha) => linha.id },
  {
    chave: 'status',
    titulo: 'Status',
    celula: (linha) => <Status cor={linha.status === 'Entregue' ? 'verde' : 'vermelho'}>{linha.status}</Status>,
  },
  { chave: 'pontos', titulo: 'Pontos', alinhamento: 'fim', celula: (linha) => linha.pontos },
  { chave: 'acoes', titulo: 'Ações', tituloOculto: true, largura: '48px', celula: () => <button type="button">…</button> },
];

const vazio = <EstadoVazio titulo="Nenhuma execução ainda" descricao="Publique uma versão e execute o primeiro lote." />;

function renderizar(props: Partial<TabelaProps<Execucao>> = {}) {
  return render(
    <Tabela<Execucao>
      legenda="Execuções recentes"
      colunas={colunas}
      linhas={execucoes}
      chaveLinha={(linha) => linha.id}
      vazio={vazio}
      {...props}
    />,
  );
}

describe('Tabela', () => {
  it('é uma tabela com nome, cabeçalhos de coluna e uma linha por item', () => {
    renderizar();
    const tabela = screen.getByRole('table', { name: 'Execuções recentes' });
    const cabecalhos = within(tabela).getAllByRole('columnheader');
    expect(cabecalhos.map((cabecalho) => cabecalho.textContent)).toEqual(['Execução', 'Status', 'Pontos', 'Ações']);
    cabecalhos.forEach((cabecalho) => expect(cabecalho).toHaveAttribute('scope', 'col'));
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3);
    expect(within(linhas[1] as HTMLElement).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      'r_1114_002',
      'Com erros',
      '9.842',
      '…',
    ]);
  });

  it('a legenda e o título oculto só aparecem para o leitor de tela', () => {
    renderizar();
    expect(screen.getByText('Execuções recentes')).toHaveClass('fc-oculto-visualmente');
    expect(screen.getByText('Ações')).toHaveClass('fc-oculto-visualmente');
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toHaveStyle({ width: '48px' });
  });

  it('valor vazio vira "—"', () => {
    renderizar();
    const linha = screen.getAllByRole('row')[2] as HTMLElement;
    expect(within(linha).getAllByRole('cell')[2]).toHaveTextContent('—');
  });

  it('alinha números ao fim', () => {
    renderizar();
    expect(screen.getByRole('columnheader', { name: 'Pontos' })).toHaveClass('fc-tabela-fim');
    expect(screen.getByRole('cell', { name: '9.842' })).toHaveClass('fc-tabela-fim');
  });

  it('vazio: mostra o estado vazio numa célula que ocupa a largura toda', () => {
    renderizar({ linhas: [] });
    const celula = screen.getByText('Nenhuma execução ainda').closest('td');
    expect(celula).toHaveAttribute('colspan', '4');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('linhas indefinidas e sem carregar também contam como vazio', () => {
    renderizar({ linhas: undefined });
    expect(screen.getByText('Nenhuma execução ainda')).toBeInTheDocument();
  });

  it('carregando: esqueleto no lugar das linhas, tabela ocupada e anúncio para o leitor de tela', () => {
    const { container } = renderizar({ carregando: true, linhas: undefined, linhasCarregando: 4 });
    const tabela = screen.getByRole('table', { name: 'Execuções recentes' });
    expect(tabela).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando execuções recentes');
    const esqueleto = container.querySelectorAll('tbody tr');
    expect(esqueleto).toHaveLength(4);
    esqueleto.forEach((linha) => expect(linha).toHaveAttribute('aria-hidden', 'true'));
    expect(container.querySelectorAll('tbody .fc-esqueleto')).toHaveLength(16);
    expect(screen.queryByText('Nenhuma execução ainda')).toBeNull();
    expect(screen.queryByText('r_1114_002')).toBeNull();
  });

  it('ao terminar de carregar, o anúncio some e as linhas aparecem', () => {
    const { rerender } = renderizar({ carregando: true });
    const anuncio = screen.getByRole('status');
    rerender(
      <Tabela<Execucao> legenda="Execuções recentes" colunas={colunas} linhas={execucoes} chaveLinha={(linha) => linha.id} vazio={vazio} />,
    );
    expect(anuncio).toBeEmptyDOMElement();
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-busy');
    expect(screen.getByText('r_1114_002')).toBeInTheDocument();
  });

  it('erro: mostra o erro no lugar das linhas e do vazio', () => {
    renderizar({
      linhas: [],
      erro: <Aviso tipo="erro">Não foi possível carregar as execuções. Tente de novo em instantes.</Aviso>,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as execuções');
    expect(screen.getByRole('alert').closest('td')).toHaveAttribute('colspan', '4');
    expect(screen.queryByText('Nenhuma execução ainda')).toBeNull();
  });

  it('carregando vence o erro (nova tentativa em andamento)', () => {
    renderizar({ carregando: true, erro: <Aviso tipo="erro">Falhou</Aviso> });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });
});
