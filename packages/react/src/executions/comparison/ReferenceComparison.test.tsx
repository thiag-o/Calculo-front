// The comparison with the reference file at the top of the panel of a simulation (E7-26): the summary with the percent of
// the API, the counts, the diff with the outcome filter and the cursor, the states and the trace drawer.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import {
  OPERATOR_PERMISSIONS,
  VIEWER_PERMISSIONS,
  completed,
  execution,
  json,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from '../api/executions.test-support';
import { ExecutionPanel } from '../detail';

const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
const GET = `GET /v1/executions/${ID}`;
const COMPARISON = `GET /v1/executions/${ID}/comparison/records`;
const RECORDS = `GET /v1/executions/${ID}/records`;
const REFERENCE_FILE = { id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e1f', name: 'esperado-fevereiro.csv' };

/** Who triggers simulations: sees the diff without `traces.view`. */
const SIMULATOR_PERMISSIONS = ['workflows.view', 'executions.view', 'simulations.run'];
/** Who only reads the traces: also sees the diff. */
const TRACE_READER_PERMISSIONS = ['workflows.view', 'executions.view', 'traces.view'];

type Execution = Schemas['Execution'];
type ComparisonSummary = Schemas['ComparisonSummary'];
type ComparisonRecord = Schemas['ComparisonRecord'];

const ALL_EQUAL: ComparisonSummary = {
  compared: 58,
  equal: 58,
  different: 0,
  status_differs: 0,
  missing_from_result: 0,
  missing_from_file: 0,
  not_compared: 3,
  equal_percent: '100.00',
};

const ONE_DIFFERENT: ComparisonSummary = {
  compared: 58,
  equal: 57,
  different: 1,
  status_differs: 0,
  missing_from_result: 0,
  missing_from_file: 0,
  not_compared: 0,
  equal_percent: '98.27',
};

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi(SIMULATOR_PERMISSIONS);
  api.respond(RECORDS, json({ items: [], next_cursor: null }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function simulation(partial: Partial<Execution> = {}): Execution {
  return completed({
    id: ID,
    mode: 'simulation',
    output: { available: false, expires_at: null, rows: null },
    reference_file: REFERENCE_FILE,
    comparison: ALL_EQUAL,
    ...partial,
  });
}

function compared(partial: Partial<ComparisonRecord> = {}): ComparisonRecord {
  return {
    result_key: 'nf_id=10|item_seq=1',
    record_key: { nf_id: '10', item_seq: '1' },
    outcome: 'different',
    expected_status: null,
    obtained_status: 'ok',
    fields: [{ name: 'pontos', expected: '1500.00', obtained: '1250.5' }],
    ...partial,
  };
}

function diffPage(items: readonly ComparisonRecord[], nextCursor: string | null = null): Response {
  return json({ items, next_cursor: nextCursor });
}

function renderPanel() {
  return renderScreen(<ExecutionPanel executionId={ID} />);
}

async function comparisonSection(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Comparação com o arquivo de referência' });
}

function outcomesAsked(request: Request): string[] {
  return new URL(request.url).searchParams.getAll('outcome');
}

describe('Comparação com o arquivo de referência', () => {
  it('a 100% mostra "100% iguais", as contagens e "Nenhuma divergência"', async () => {
    api.respond(GET, json(simulation()));
    api.respond(COMPARISON, diffPage([]));
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('esperado-fevereiro.csv')).toBeInTheDocument();
    expect(within(section).getByText('100% iguais · 58 de 58 registros')).toBeInTheDocument();
    const counts = section.querySelector('dl[aria-label="Contagens da comparação"]')!;
    const pairs = Array.from(counts.querySelectorAll('div')).map((pair) => pair.textContent);
    expect(pairs).toEqual([
      'Iguais58',
      'Diferentes0',
      'Status diferente0',
      'Fora do resultado0',
      'Fora do arquivo0',
      'Fora da comparação3',
    ]);
    expect(await within(section).findByText('Nenhuma divergência')).toBeInTheDocument();
    // The default view asks only the divergences.
    expect(outcomesAsked(api.callsTo(COMPARISON)[0]!).sort()).toEqual(['different', 'missing_from_file', 'missing_from_result', 'status_differs']);
  });

  it('com divergências mostra o percentual da API no padrão brasileiro, sem recalcular', async () => {
    // 57 / 58 = 98,275…: the API truncates to "98.27", and the screen shows that, not 98,28.
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, diffPage([compared()]));
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('98,27% iguais · 57 de 58 registros')).toBeInTheDocument();
  });

  it('com milhares de registros, as contagens e o resumo usam o ponto de milhar', async () => {
    api.respond(GET, json(simulation({ comparison: { ...ONE_DIFFERENT, compared: 2400, equal: 2399, different: 1, equal_percent: '99.95' } })));
    api.respond(COMPARISON, diffPage([compared()]));
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('99,95% iguais · 2.399 de 2.400 registros')).toBeInTheDocument();
  });

  it('esperado × obtido com números no padrão brasileiro e o nulo como "vazio"', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(
      COMPARISON,
      diffPage([
        compared({
          fields: [
            { name: 'pontos', expected: '1500.00', obtained: '1250.5' },
            { name: 'bonus', expected: null, obtained: '-3' },
            { name: 'categoria', expected: 'A', obtained: 'B' },
            { name: 'codigo', expected: '007', obtained: '008' },
          ],
        }),
      ]),
    );
    renderPanel();

    const section = await comparisonSection();
    const table = await within(section).findByRole('table', { name: 'Registros comparados com o arquivo' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByText('diferente')).toBeInTheDocument();
    const fields = within(row).getAllByRole('listitem').map((item) => item.textContent);
    expect(fields).toEqual([
      'pontosesperado 1.500,00 × , obtido 1.250,5',
      'bonusesperado vazio × , obtido -3',
      'categoriaesperado A × , obtido B',
      // A code with zeros on the left is text, not a number.
      'codigoesperado 007 × , obtido 008',
    ]);
  });

  it('cada resultado aparece com ponto e palavra, e o status diferente mostra as duas classes', async () => {
    api.respond(GET, json(simulation({ comparison: { ...ONE_DIFFERENT, status_differs: 1, missing_from_result: 1, missing_from_file: 1 } })));
    api.respond(
      COMPARISON,
      diffPage([
        compared({ result_key: 'a', record_key: { nf_id: '1' }, outcome: 'status_differs', expected_status: null, obtained_status: 'error', fields: [] }),
        compared({ result_key: 'b', record_key: { nf_id: '2' }, outcome: 'missing_from_result', obtained_status: null, fields: [] }),
        compared({ result_key: 'c', record_key: { nf_id: '3' }, outcome: 'missing_from_file', expected_status: null, obtained_status: 'ok', fields: [] }),
      ]),
    );
    renderPanel();

    const table = await screen.findByRole('table', { name: 'Registros comparados com o arquivo' });
    const [, statusRow, missingRow, extraRow] = within(table).getAllByRole('row');
    expect(within(statusRow!).getByText('status diferente')).toBeInTheDocument();
    expect(within(statusRow!).getByRole('listitem')).toHaveTextContent('statusesperado calculado × , obtido erro');
    expect(within(missingRow!).getByText('fora do resultado')).toBeInTheDocument();
    expect(within(missingRow!).getByText('A simulação não leu este registro do arquivo.')).toBeInTheDocument();
    // Missing from the result: no trace to open.
    expect(within(missingRow!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(missingRow!).getByText('Sem trace: o registro não está no resultado')).toBeInTheDocument();
    expect(within(extraRow!).getByText('fora do arquivo')).toBeInTheDocument();
    expect(within(extraRow!).getByRole('button', { name: 'Abrir o trace de nf_id 3' })).toBeInTheDocument();
    // Dot + word: the divergence in amber.
    expect(within(statusRow!).getByText('status diferente').closest('.fc-status')).toHaveClass('fc-status-amber');
  });

  it('o filtro por resultado pede à API só o resultado escolhido', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, (request) => {
      const outcomes = outcomesAsked(request);
      if (outcomes.length === 1 && outcomes[0] === 'equal') {
        return diffPage([compared({ result_key: 'eq', record_key: { nf_id: '11' }, outcome: 'equal', fields: [] })]);
      }
      return diffPage([compared()]);
    });
    const { user } = renderPanel();

    const table = await screen.findByRole('table', { name: 'Registros comparados com o arquivo' });
    expect(await within(table).findByText('diferente')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Resultado' }));
    await user.click(await screen.findByRole('option', { name: 'Iguais' }));

    expect(await within(table).findByText('igual')).toBeInTheDocument();
    expect(within(table).queryByText('diferente')).not.toBeInTheDocument();
    expect(outcomesAsked(api.callsTo(COMPARISON).at(-1)!)).toEqual(['equal']);

    await user.click(screen.getByRole('combobox', { name: 'Resultado' }));
    await user.click(await screen.findByRole('option', { name: 'Todos os registros' }));
    await waitFor(() => expect(outcomesAsked(api.callsTo(COMPARISON).at(-1)!)).toEqual([]));
  });

  it('um resultado sem registros mostra o vazio do filtro e volta para as divergências', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, (request) => (outcomesAsked(request)[0] === 'missing_from_file' && outcomesAsked(request).length === 1 ? diffPage([]) : diffPage([compared()])));
    const { user } = renderPanel();

    await screen.findByRole('table', { name: 'Registros comparados com o arquivo' });
    await user.click(screen.getByRole('combobox', { name: 'Resultado' }));
    await user.click(await screen.findByRole('option', { name: 'Fora do arquivo' }));
    expect(await screen.findByText('Nenhum registro com esse resultado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver as divergências' }));
    expect(await screen.findByText('diferente')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Resultado' })).toHaveFocus();
  });

  it('pagina por cursor com "Carregar mais registros"', async () => {
    api.respond(GET, json(simulation({ comparison: { ...ONE_DIFFERENT, different: 2 } })));
    api.respond(COMPARISON, (request) =>
      new URL(request.url).searchParams.get('cursor') === 'pagina-2'
        ? diffPage([compared({ result_key: 'b', record_key: { nf_id: '20' } })])
        : diffPage([compared({ result_key: 'a', record_key: { nf_id: '10' } })], 'pagina-2'),
    );
    const { user } = renderPanel();

    const table = await screen.findByRole('table', { name: 'Registros comparados com o arquivo' });
    expect(await within(table).findByRole('button', { name: 'Abrir o trace de nf_id 10' })).toBeInTheDocument();
    expect(screen.getByText('Mais de 1 registros')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carregar mais registros' }));
    expect(await within(table).findByRole('button', { name: 'Abrir o trace de nf_id 20' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais registros' })).not.toBeInTheDocument();
    expect(new URL(api.callsTo(COMPARISON).at(-1)!.url).searchParams.get('cursor')).toBe('pagina-2');
  });

  it('carregando: a tabela mostra o esqueleto até a primeira página chegar', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    let answer: (response: Response) => void = () => {};
    api.respond(COMPARISON, () => new Promise<Response>((resolve) => (answer = resolve)));
    renderPanel();

    const table = await screen.findByRole('table', { name: 'Registros comparados com o arquivo' });
    expect(table).toHaveAttribute('aria-busy', 'true');
    answer(diffPage([compared()]));
    expect(await within(table).findByText('diferente')).toBeInTheDocument();
    expect(table).not.toHaveAttribute('aria-busy', 'true');
  });

  it('erro: a nota diz o que houve e "Tentar de novo" pede de novo', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, problem(404, 'comparison_not_available'), diffPage([compared()]));
    const { user } = renderPanel();

    expect(await screen.findByText('Não foi possível carregar a comparação')).toBeInTheDocument();
    expect(screen.getByText('Esta simulação ainda não tem a comparação com o arquivo. Tente de novo quando ela terminar.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('diferente')).toBeInTheDocument();
  });

  it('antes do fim da comparação, mostra o aviso e não pede o diff', async () => {
    api.respond(GET, json(simulation({ status: 'comparing', finished_at: null, comparison: null })));
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('O resumo aparece quando a simulação terminar de comparar os registros com o arquivo.')).toBeInTheDocument();
    expect(api.callsTo(COMPARISON)).toHaveLength(0);
  });

  it('a simulação abortada antes de comparar diz que não houve comparação', async () => {
    api.respond(
      GET,
      json(simulation({ status: 'cancelled', comparison: null, cancel_requested_at: '2026-11-21T15:01:00Z' })),
    );
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('A simulação parou antes de comparar os registros com o arquivo.')).toBeInTheDocument();
  });

  it('sem simulations.run nem traces.view, o resumo aparece e a tabela fica escondida', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    renderPanel();

    const section = await comparisonSection();
    expect(within(section).getByText('98,27% iguais · 57 de 58 registros')).toBeInTheDocument();
    expect(within(section).queryByRole('table')).not.toBeInTheDocument();
    expect(within(section).queryByRole('combobox', { name: 'Resultado' })).not.toBeInTheDocument();
    expect(api.callsTo(COMPARISON)).toHaveLength(0);
  });

  it('só com traces.view a tabela aparece', async () => {
    api = simulateApi(TRACE_READER_PERMISSIONS);
    api.respond(RECORDS, json({ items: [], next_cursor: null }));
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, diffPage([compared()]));
    renderPanel();

    const section = await comparisonSection();
    expect(await within(section).findByRole('table', { name: 'Registros comparados com o arquivo' })).toBeInTheDocument();
  });

  it('clicar num registro abre a gaveta do trace, e fechar devolve o foco', async () => {
    api.respond(GET, json(simulation({ comparison: ONE_DIFFERENT })));
    api.respond(COMPARISON, diffPage([compared()]));
    const record: Schemas['ExecutionRecord'] = {
      execution_id: ID,
      trace_level: 'minimal',
      record_key: { nf_id: '10', item_seq: '1' },
      status: 'ok',
      input_hash: 'a'.repeat(64),
      output_hash: 'b'.repeat(64),
      outputs: null,
      trace: null,
    };
    const RECORD = `GET /v1/executions/${ID}/records/${encodeURIComponent('nf_id=10|item_seq=1')}`;
    api.respond(RECORD, json(record));
    const { user } = renderPanel();

    const key = await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' });
    await user.click(key);

    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('Esta execução guardou o trace mínimo.')).toBeInTheDocument();
    expect(api.callsTo(RECORD)).toHaveLength(1);

    await user.click(within(drawer).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(key).toHaveFocus();
  });

  it('o lote não tem a seção de comparação', async () => {
    api = simulateApi(OPERATOR_PERMISSIONS);
    api.respond(RECORDS, json({ items: [], next_cursor: null }));
    api.respond(GET, json(completed({ id: ID })));
    renderPanel();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Comparação com o arquivo de referência' })).not.toBeInTheDocument();
  });

  it('a simulação sem arquivo de referência não tem a seção de comparação', async () => {
    api.respond(GET, json(execution({ id: ID, mode: 'simulation', status: 'calculating' })));
    renderPanel();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Comparação com o arquivo de referência' })).not.toBeInTheDocument();
  });
});
