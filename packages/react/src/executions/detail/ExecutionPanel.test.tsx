import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
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
import { dateTime } from '../list/format';
import { ExecutionPanel } from '.';

const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
const GET = `GET /v1/executions/${ID}`;
const CANCEL = `POST /v1/executions/${ID}/cancel`;
const OUTPUT = `GET /v1/executions/${ID}/output`;
const RECORDS = `GET /v1/executions/${ID}/records`;
const RESULT_KEY = 'a'.repeat(64);
const RECORD = `GET /v1/executions/${ID}/records/${RESULT_KEY}`;
const DEFINITION_ROUTE = `GET /v1/executions/${ID}/definition`;

/** The Operator who also sees the trace (the Auditor's `traces.view`). */
const TRACE_PERMISSIONS = [...OPERATOR_PERMISSIONS, 'traces.view'];

type Execution = Schemas['Execution'];
type RecordSummary = Schemas['ExecutionRecordSummary'];

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi(TRACE_PERMISSIONS);
  api.respond(RECORDS, json({ items: [], next_cursor: null }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function withId(partial: Partial<Execution> = {}): Execution {
  return execution({ id: ID, ...partial });
}

function finished(partial: Partial<Execution> = {}): Execution {
  return completed({ id: ID, ...partial });
}

function summary(partial: Partial<RecordSummary> = {}): RecordSummary {
  return {
    result_key: RESULT_KEY,
    record_key: { nf_id: '10', item_seq: '1' },
    status: 'ok',
    error_node_id: null,
    error_code: null,
    ...partial,
  };
}

const TRACE: Schemas['UnitRunTrace'] = {
  status: 'ok',
  record_key: { nf_id: '10', item_seq: '1' },
  inputs: [],
  nodes: [],
  outputs: { pontos: '1500.00' },
  input_hash: 'sha256:77b0db21bf50aa',
  output_hash: 'sha256:1c2d3e4f5a6b7c',
  error: null,
  warnings: [],
};

/** The definition the execution ran, frozen: it names the block of the trace. */
const FROZEN: Schemas['ExecutionDefinition'] = {
  draft_revision: 5,
  definition: {
    schema_version: 3,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard', pre_validation_alert_percent: '1' },
    parameters: [],
    root: {
      batch_source: null,
      inputs: [],
      nodes: [
        {
          id: 'calc_pontos',
          type: 'calculation',
          name: 'Pontos do item',
          description: null,
          position: { x: 0, y: 0 },
          expression: 'valor * 1,5',
          output: { name: 'pontos', type: 'decimal', scale: 2 },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
      ],
      output: { fields: [{ name: 'pontos', variable: 'pontos' }] },
    },
  },
};

function storedRecord(level: Schemas['TraceLevel']): Schemas['ExecutionRecord'] {
  const minimal = level === 'minimal';
  return {
    execution_id: ID,
    trace_level: level,
    record_key: { nf_id: '10', item_seq: '1' },
    status: 'ok',
    input_hash: 'sha256:77b0db21bf50aa',
    output_hash: 'sha256:1c2d3e4f5a6b7c',
    outputs: minimal ? null : { pontos: '1500.00' },
    trace: minimal ? null : TRACE,
  };
}

function renderPanel(props: Partial<Parameters<typeof ExecutionPanel>[0]> = {}, options: Parameters<typeof renderScreen>[1] = {}) {
  return renderScreen(<ExecutionPanel executionId={ID} {...props} />, options);
}

function queryOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

describe('Painel da execução: estados', () => {
  const cases: [Execution['status'], string][] = [
    ['pending', 'Na fila'],
    ['loading', 'Calculando'],
    ['awaiting_source', 'Aguardando fonte'],
    ['calculating', 'Calculando'],
    ['delivering', 'Calculando'],
    ['completed', 'Entregue'],
    ['completed_with_errors', 'Com erros'],
    ['aborted', 'Abortada'],
    ['cancelled', 'Cancelada'],
  ];

  it.each(cases)('%s aparece como "%s", com o nome do workflow e a revisão', async (status, label) => {
    api.respond(GET, json(withId({ status, ...(status === 'aborted' ? { abort_reason: { code: 'internal_error', message: 'A execução parou por um erro interno. Nada foi entregue.' } } : {}) })));
    renderPanel();

    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.getAllByText(label)[0]).toBeInTheDocument();
    expect(screen.getByText('Revisão 5 do rascunho')).toBeInTheDocument();
  });

  it('carregando: esqueleto anunciado; erro not_found sem Tentar de novo', async () => {
    api.respond(GET, problem(404, 'not_found'));
    renderPanel();
    expect(screen.getByText('Carregando a execução')).toBeInTheDocument();

    expect(await screen.findByText(/Esta execução não existe neste tenant/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('erro de conexão oferece Tentar de novo, que busca de novo', async () => {
    api.respond(GET, problem(500, 'internal_error'), json(withId()));
    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
  });

  it('awaiting_source: avisa da espera pela fonte e marca a fase em que parou', async () => {
    api.respond(GET, json(withId({ status: 'awaiting_source', started_at: '2026-11-21T15:00:05Z', total_records: 2400, progress: { chunks_done: 2, records_done: 1000 } })));
    renderPanel();

    const note = await screen.findByText('Aguardando a fonte');
    expect(note.closest('[role="status"]')).toHaveTextContent('tenta de novo sozinha depois de 30 s, 2 min e 10 min');
    expect(note.closest('[role="status"]')).not.toHaveTextContent('A próxima tentativa é em');
    const phases = screen.getByRole('region', { name: 'Fases' });
    const current = within(phases).getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('Cálculoaguardando a fonte');
  });

  it('awaiting_source com next_retry_at: o aviso diz a hora da próxima tentativa', async () => {
    api.respond(GET, json(withId({ status: 'awaiting_source', started_at: '2026-11-21T15:30:01Z', next_retry_at: '2026-11-21T15:30:34Z' })));
    renderPanel();

    const note = await screen.findByText('Aguardando a fonte');
    expect(note.closest('[role="status"]')).toHaveTextContent(`A próxima tentativa é em ${dateTime('2026-11-21T15:30:34Z')}.`);
  });

  it('awaiting_source antes de contar o lote: a fase de Carga espera e nenhuma barra aparece', async () => {
    api.respond(GET, json(withId({ status: 'awaiting_source', started_at: '2026-11-21T15:00:05Z' })));
    renderPanel();
    const phases = await screen.findByRole('region', { name: 'Fases' });
    const items = within(phases).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargaaguardando a fonte');
    expect(items[1]).toHaveTextContent('Pré-validaçãoa fazer');
    expect(items[2]).toHaveTextContent('Cálculoa fazer');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Contando os registros do lote')).toBeInTheDocument();
  });

  const reasons: [Schemas['AbortReason'], string, RegExp][] = [
    ['error_limit_exceeded', 'Os erros passaram do limite de erro do workflow. Nada foi entregue.', /Veja os erros agrupados abaixo/],
    ['source_unavailable', 'Uma fonte ficou fora do ar depois de três novas tentativas. Nada foi entregue.', /Confira se a conexão da fonte está no ar/],
    ['schema_drift', 'Uma coluna de uma fonte mudou ou não existe mais na origem. Nada foi entregue.', /Ajuste o dataset e as variáveis no catálogo/],
    ['source_read_denied', 'O usuário de uma conexão não tem permissão de leitura numa fonte. Nada foi entregue.', /permissão de leitura para o usuário da conexão/],
    ['parameter_table_rows', 'Uma tabela de parâmetros não tem exatamente uma linha. Nada foi entregue.', /exatamente uma linha e execute o lote de novo/],
    ['internal_error', 'A execução parou por um erro interno. Nada foi entregue.', /avise o suporte com o id desta execução/],
    ['connection_not_allowed', 'A conexão de uma fonte não é permitida pela configuração (TLS ou destino). Ajuste a conexão e execute de novo.', /Ajuste a conexão da fonte no catálogo/],
    ['excel_file_unreadable', 'O arquivo não pode ser lido. Envie o arquivo de novo.', /Envie o arquivo Excel de novo no catálogo/],
    ['duplicate_record_key', 'A chave do registro se repete no lote. Nada foi calculado: corrija a origem ou a chave do registro.', /Corrija a origem ou a chave do registro no workflow/],
  ];

  it.each(reasons)('abortada por %s: mostra o código, a mensagem do back e o que fazer', async (code, message, guidance) => {
    api.respond(
      GET,
      json(finished({ status: 'aborted', abort_reason: { code, message }, output: { available: false, expires_at: null, rows: null }, total_records: 1180, progress: { chunks_done: 1, records_done: 400 } })),
    );
    renderPanel();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Execução abortada');
    expect(alert).toHaveTextContent(code);
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent(guidance);
    const items = within(screen.getByRole('region', { name: 'Fases' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargaconcluída');
    expect(items[1]).toHaveTextContent('Pré-validaçãoconcluída');
    expect(items[2]).toHaveTextContent('Cálculointerrompida');
  });

  it('cancelamento pedido: avisa que a execução para no fim da parte em andamento', async () => {
    api.respond(GET, json(withId({ status: 'calculating', cancel_requested_at: '2026-11-21T15:02:00Z', total_records: 100, progress: { chunks_done: 1, records_done: 50 } })));
    renderPanel();
    expect(await screen.findByText('Cancelamento pedido')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Pedido em ${dateTime('2026-11-21T15:02:00Z')}`))).toBeInTheDocument();
  });
});

describe('Painel da execução: progresso, resumo e totais', () => {
  it('mostra os registros feitos sobre o total na barra e as fases até o cálculo', async () => {
    api.respond(GET, json(withId({ status: 'calculating', started_at: '2026-11-21T15:00:05Z', total_records: 2400, progress: { chunks_done: 3, records_done: 1180 } })));
    renderPanel();

    const bar = await screen.findByRole('progressbar', { name: 'Registros calculados' });
    expect(bar).toHaveAttribute('aria-valuenow', '1180');
    expect(bar).toHaveAttribute('aria-valuemax', '2400');
    expect(bar).toHaveAttribute('aria-valuetext', '1.180 de 2.400 registros · 49%');
    expect(screen.getByText('1.180 de 2.400 registros · 49%')).toBeInTheDocument();
    const items = within(screen.getByRole('region', { name: 'Fases' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Cargaconcluída', 'Pré-validaçãoconcluída', 'Cálculoem andamento', 'Entregaa fazer']);
  });

  it('entregue: as quatro fases concluídas e a barra cheia', async () => {
    api.respond(GET, json(finished()));
    renderPanel();
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuetext', '1.180 de 1.180 registros · 100%');
    const items = within(screen.getByRole('region', { name: 'Fases' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Cargaconcluída', 'Pré-validaçãoconcluída', 'Cálculoconcluída', 'Entregaconcluída']);
  });

  it('resumo com os parâmetros resolvidos, o agora, o nível do trace, o limite e quem disparou', async () => {
    api.respond(GET, json(finished({ error_limit_percent: '2.5', trace_level: 'minimal' })));
    renderPanel();

    const parameters = await screen.findByRole('region', { name: 'Resumo' });
    expect(parameters).toHaveTextContent('periodo01/10/2026 a 31/10/2026');
    expect(parameters).toHaveTextContent('categoriasA, B');
    expect(parameters).toHaveTextContent('meta_minima100,00');
    const run = parameters;
    expect(run).toHaveTextContent(`Agora${dateTime('2026-11-21T15:00:00Z')}`);
    expect(run).toHaveTextContent('Nível do traceMínimo');
    expect(run).toHaveTextContent('Limite de erro2,5%');
    expect(run).toHaveTextContent(`Disparado porAna Souza em ${dateTime('2026-11-21T15:00:00Z')}`);
    expect(run).toHaveTextContent('Duração4m 12s');
  });

  it('totais: lidos, ok, com avisos, com erro, ignorados e filtrados', async () => {
    api.respond(GET, json(finished({ totals: { read: 1300, ok: 1160, ok_with_warnings: 20, error: 12, ignored: 100, filtered: 8 } })));
    renderPanel();
    const totals = await screen.findByRole('region', { name: 'Totais' });
    expect(totals).toHaveTextContent('Lidos1.300');
    expect(totals).toHaveTextContent('Ok1.160');
    expect(totals).toHaveTextContent('Com avisos20');
    expect(totals).toHaveTextContent('Com erro12');
    expect(totals).toHaveTextContent('Ignorados100');
    expect(totals).toHaveTextContent('Filtrados8');
  });
});

describe('Painel da execução: erros agrupados e registros', () => {
  const groups: Schemas['ErrorGroup'][] = [
    { node_id: 'calc_pontos', node_name: 'Pontos do item', code: 'division_by_zero', count: 9 },
    { node_id: null, node_name: null, code: 'duplicate_record_key', count: 3 },
  ];

  it('clicar num grupo filtra os registros pelo nó e pelo código, e o foco vai para os registros', async () => {
    api.respond(GET, json(finished({ status: 'completed_with_errors', error_groups: groups })));
    const failed = summary({ result_key: 'b'.repeat(64), record_key: { nf_id: '11', item_seq: '1' }, status: 'error', error_node_id: 'calc_pontos', error_code: 'division_by_zero' });
    api.respond(RECORDS, (request) =>
      json({ items: queryOf(request).has('code') ? [failed] : [summary(), failed], next_cursor: null }),
    );
    const { user } = renderPanel();

    expect(await screen.findByText('nf_id 10 · item_seq 1')).toBeInTheDocument();
    const group = screen.getByRole('button', { name: 'Pontos do item, division_by_zero: 9 registros. Filtrar os registros' });
    await user.click(group);

    await waitFor(() => expect(screen.queryByText('nf_id 10 · item_seq 1')).not.toBeInTheDocument());
    expect(screen.getByText('nf_id 11 · item_seq 1')).toBeInTheDocument();
    const last = api.callsTo(RECORDS).at(-1)!;
    expect(queryOf(last).get('node_id')).toBe('calc_pontos');
    expect(queryOf(last).get('code')).toBe('division_by_zero');
    expect(queryOf(last).has('without_node')).toBe(false);
    expect(group).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Registros' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Filtros dos registros' })).toHaveTextContent('Pontos do item');

    await user.click(screen.getByRole('button', { name: 'Limpar filtro do erro' }));
    expect(await screen.findByText('nf_id 10 · item_seq 1')).toBeInTheDocument();
    expect(group).toHaveAttribute('aria-pressed', 'false');
  });

  it('grupo sem nó (chave do lote) filtra com without_node=true e pelo código, e o registro sem trace não abre a gaveta', async () => {
    api.respond(GET, json(finished({ status: 'completed_with_errors', error_groups: groups })));
    api.respond(
      RECORDS,
      json({ items: [summary({ result_key: null, record_key: { nf_id: '12', item_seq: '1' }, status: 'error', error_code: 'duplicate_record_key' })], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Chave do lote, duplicate_record_key: 3 registros. Filtrar os registros' }));
    await waitFor(() => expect(queryOf(api.callsTo(RECORDS).at(-1)!).get('code')).toBe('duplicate_record_key'));
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).get('without_node')).toBe('true');
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).has('node_id')).toBe(false);

    const table = screen.getByRole('table', { name: 'Registros da execução' });
    expect(within(table).getByText('Sem trace: o registro não foi calculado')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /Abrir o trace/ })).not.toBeInTheDocument();
    expect(within(table).getByText('Chave do lote')).toBeInTheDocument();
  });

  it('registros sem result_key com a mesma chave e o mesmo código aparecem todos, sem chave repetida', async () => {
    api.respond(GET, json(finished({ status: 'completed_with_errors', error_groups: groups })));
    const twin = summary({ result_key: null, record_key: { nf_id: '12', item_seq: '1' }, status: 'error', error_code: 'duplicate_record_key' });
    api.respond(RECORDS, json({ items: [twin, { ...twin }], next_cursor: null }));
    const consoleError = vi.spyOn(console, 'error');
    renderPanel();

    const table = await screen.findByRole('table', { name: 'Registros da execução' });
    await waitFor(() => expect(within(table).getAllByText('nf_id 12 · item_seq 1')).toHaveLength(2));
    expect(consoleError.mock.calls.some((call) => call.map(String).join(' ').includes('same key'))).toBe(false);
  });

  it('filtra os registros pelo status e carrega mais pelo cursor', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      json({ items: [summary({ result_key: 'c'.repeat(64), record_key: { nf_id: '20', item_seq: '1' } })], next_cursor: null }),
      json({ items: [], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Carregar mais registros' }));
    expect(await screen.findByText('nf_id 20 · item_seq 1')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS)[1]!).get('cursor')).toBe('c2');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'filtrado' }));
    expect(await screen.findByText('Nenhum registro com esse filtro')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).getAll('status')).toEqual(['filtered']);
  });

  it('sem traces.view: a tabela de registros não aparece, nada é pedido e os grupos não são botões', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(GET, json(finished({ status: 'completed_with_errors', error_groups: groups })));
    const { queryClient } = renderPanel();

    expect(await screen.findByText('Pontos do item')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('heading', { name: 'Registros' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filtrar os registros/ })).not.toBeInTheDocument();
    expect(api.callsTo(RECORDS)).toHaveLength(0);
  });

  it('sem erros: diz que nenhum registro deu erro', async () => {
    api.respond(GET, json(finished()));
    renderPanel();
    expect(await screen.findByText('Nenhum registro com erro.')).toBeInTheDocument();
  });

  it('erro ao ler os registros: nota com Tentar de novo', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, problem(403, 'no_permission'), json({ items: [summary()], next_cursor: null }));
    const { user } = renderPanel();
    expect(await screen.findByText(/não tem permissão para ver os registros/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('nf_id 10 · item_seq 1')).toBeInTheDocument();
  });
});

describe('Painel da execução: gaveta do trace', () => {
  it('no nível Padrão, a gaveta passa o trace guardado e a definição congelada ao componente do trace', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, json({ items: [summary()], next_cursor: null }));
    api.respond(RECORD, json(storedRecord('standard')));
    api.respond(DEFINITION_ROUTE, json(FROZEN));
    const renderRecordTrace = vi.fn(({ trace, definition }: { trace: Schemas['UnitRunTrace']; definition: Schemas['WorkflowDefinition'] }) => (
      <p>{`trace com ${Object.keys(trace.outputs).join(', ')} de ${definition.root.nodes.map((node) => node.name).join(', ')}`}</p>
    ));
    const { user } = renderPanel({ renderRecordTrace });

    const open = await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' });
    await user.click(open);

    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('trace com pontos de Pontos do item')).toBeInTheDocument();
    expect(within(drawer).queryByText(/Nomes e formatação chegam/)).not.toBeInTheDocument();
    expect(within(drawer).getByText('ok')).toBeInTheDocument();
    expect(renderRecordTrace).toHaveBeenCalledWith(expect.objectContaining({ trace: TRACE, definition: FROZEN.definition }));
    expect(api.callsTo(DEFINITION_ROUTE)).toHaveLength(1);
    expect(within(drawer).queryByText('Esta execução guardou o trace mínimo.')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(open).toHaveFocus();
  });

  it('sem o componente do trace, a gaveta mostra as saídas como vêm da API e os hashes', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, json({ items: [summary()], next_cursor: null }));
    api.respond(RECORD, json(storedRecord('standard')));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('1500.00')).toBeInTheDocument();
    expect(within(drawer).getByText('sha256:77b0db21bf50aa')).toBeInTheDocument();
  });

  it('no nível Mínimo, a gaveta mostra só os hashes, com "Esta execução guardou o trace mínimo."', async () => {
    api.respond(GET, json(finished({ trace_level: 'minimal' })));
    api.respond(RECORDS, json({ items: [summary()], next_cursor: null }));
    api.respond(RECORD, json(storedRecord('minimal')));
    const renderRecordTrace = vi.fn(() => <p>trace</p>);
    const { user } = renderPanel({ renderRecordTrace });

    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('Esta execução guardou o trace mínimo.')).toBeInTheDocument();
    const hashes = within(drawer).getByLabelText('Hashes');
    expect(hashes).toHaveTextContent('Hash das entradassha256:77b0db21bf50aa');
    expect(hashes).toHaveTextContent('Hash da saídasha256:1c2d3e4f5a6b7c');
    expect(renderRecordTrace).not.toHaveBeenCalled();
    expect(api.callsTo(DEFINITION_ROUTE)).toHaveLength(0);
  });

  it('a definição congelada que falha: a gaveta avisa e o Tentar de novo a lê de novo', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, json({ items: [summary()], next_cursor: null }));
    api.respond(RECORD, json(storedRecord('standard')));
    api.respond(DEFINITION_ROUTE, problem(500, 'internal_error'), json(FROZEN));
    const renderRecordTrace = vi.fn(({ definition }: { definition: Schemas['WorkflowDefinition'] }) => <p>{`blocos: ${definition.root.nodes.length}`}</p>);
    const { user } = renderPanel({ renderRecordTrace });

    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('Não foi possível carregar a definição da execução')).toBeInTheDocument();
    expect(renderRecordTrace).not.toHaveBeenCalled();
    await user.click(within(drawer).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(drawer).findByText('blocos: 1')).toBeInTheDocument();
  });

  it('registro que não existe mais: a gaveta explica o record_not_found', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, json({ items: [summary()], next_cursor: null }));
    api.respond(RECORD, problem(404, 'record_not_found'));
    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText(/não tem mais o trace deste registro/)).toBeInTheDocument();
  });
});

describe('Painel da execução: Baixar CSV', () => {
  const disabled: [string, Execution, string][] = [
    ['rodando', withId({ status: 'calculating' }), 'O CSV fica disponível quando a execução terminar'],
    ['na fila', withId({ status: 'pending' }), 'O CSV fica disponível quando a execução terminar'],
    ['abortada', finished({ status: 'aborted', abort_reason: { code: 'error_limit_exceeded', message: 'Os erros passaram do limite.' }, output: { available: false, expires_at: null, rows: null } }), 'Execução abortada não entrega CSV'],
    ['cancelada', finished({ status: 'cancelled', output: { available: false, expires_at: null, rows: null } }), 'Execução cancelada não entrega CSV'],
    ['expirada', finished({ output: { available: false, expires_at: '2026-11-01T10:00:00Z', rows: 1180 } }), `O prazo para baixar o CSV acabou em ${dateTime('2026-11-01T10:00:00Z')}`],
  ];

  it.each(disabled)('%s: Baixar CSV desabilitado com o motivo ao lado', async (_name, current, reason) => {
    api.respond(GET, json(current));
    const { user } = renderPanel();

    const button = await screen.findByRole('button', { name: 'Baixar CSV' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeInTheDocument();
    await user.click(button);
    expect(api.callsTo(OUTPUT)).toHaveLength(0);
  });

  it('entregue: baixa o arquivo pelo navegador com o nome do Content-Disposition', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      OUTPUT,
      new Response('result_key,revision\r\n', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="execution-${ID}.csv"` } }),
    );
    const createObjectURL = vi.fn(() => 'blob:fluxo/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicks: { download: string; href: string; inModule: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href, inModule: this.closest('.fc-root') !== null });
    });
    const { user } = renderPanel();

    expect(await screen.findByText(`1.180 linhas · disponível até ${dateTime('2026-11-28T15:04:17Z')}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }));

    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(clicks[0]).toEqual({ download: `execution-${ID}.csv`, href: 'blob:fluxo/1', inModule: true });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(await screen.findByText(`CSV baixado: execution-${ID}.csv`)).toBeInTheDocument();
    expect(document.querySelector('a[download]')).toBeNull();
    // The address stays alive for a while: the browser may read it after the click.
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('o endereço do arquivo é liberado depois de 30 s, ou ao fechar o painel', async () => {
    api.respond(GET, json(finished()));
    api.respond(OUTPUT, new Response('result_key\r\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }));
    const urls = ['blob:fluxo/a', 'blob:fluxo/b'];
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => urls.shift()!), revokeObjectURL }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const { user } = renderPanel({}, { advanceTimers: vi.advanceTimersByTime });

    await user.click(await screen.findByRole('button', { name: 'Baixar CSV' }));
    await screen.findByText(/CSV baixado/);
    act(() => vi.advanceTimersByTime(29_000));
    expect(revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fluxo/a');

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }));
    await waitFor(() => expect(urls).toHaveLength(0));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar CSV' })).not.toHaveAttribute('aria-busy', 'true'));
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    cleanup();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fluxo/b');
  });

  it('o prazo vence com a tela aberta: Baixar CSV passa a desabilitado com o motivo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-28T15:03:17Z'));
    api.respond(GET, json(finished()));
    renderPanel();

    const button = await screen.findByRole('button', { name: 'Baixar CSV' });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    act(() => vi.advanceTimersByTime(60_000));

    const reason = `O prazo para baixar o CSV acabou em ${dateTime('2026-11-28T15:04:17Z')}`;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar CSV' })).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByRole('button', { name: 'Baixar CSV' })).toHaveAccessibleDescription(reason);
  });

  it('sem Content-Disposition legível (incorporado): usa execution-<id>.csv', async () => {
    api.respond(GET, json(finished()));
    api.respond(OUTPUT, new Response('result_key\r\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:fluxo/2'), revokeObjectURL: vi.fn() }));
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Baixar CSV' }));
    await waitFor(() => expect(names).toEqual([`execution-${ID}.csv`]));
  });

  it('410 output_expired: explica e lê a execução de novo', async () => {
    api.respond(GET, json(finished()), json(finished({ output: { available: false, expires_at: '2026-11-21T16:00:00Z', rows: 1180 } })));
    api.respond(OUTPUT, problem(410, 'output_expired'));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Baixar CSV' }));
    expect(await screen.findByText(/O prazo para baixar o CSV acabou e o arquivo foi apagado/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar CSV' })).toHaveAttribute('aria-disabled', 'true'));
    expect(api.callsTo(GET)).toHaveLength(2);
  });
});

describe('Painel da execução: Cancelar', () => {
  it('pede confirmação e só cancela ao confirmar', async () => {
    const running = withId({ status: 'calculating', total_records: 100, progress: { chunks_done: 1, records_done: 50 } });
    api.respond(GET, json(running));
    api.respond(CANCEL, json({ ...running, cancel_requested_at: '2026-11-21T15:02:00Z' }, 202));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar execução' }));
    let dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    expect(dialog).toHaveTextContent('Os registros já calculados não são entregues');
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(CANCEL)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Cancelar execução' }));
    dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(CANCEL)).toHaveLength(1);
    expect(await screen.findByText('Cancelamento pedido')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Cancelar execução' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('O cancelamento já foi pedido');
  });

  it('enquanto o pedido está em andamento, o diálogo não fecha', async () => {
    const running = withId({ status: 'loading' });
    api.respond(GET, json(running));
    let answer: (response: Response) => void = () => {};
    api.respond(CANCEL, () => new Promise<Response>((resolve) => (answer = resolve)));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar execução' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));
    await waitFor(() => expect(api.callsTo(CANCEL)).toHaveLength(1));
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('dialog', { name: 'Cancelar execução' })).toBeInTheDocument();

    await act(async () => answer(json({ ...running, status: 'cancelled', finished_at: '2026-11-21T15:01:00Z' }, 202)));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByText('Cancelada')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
  });

  it('409 execution_finished: explica no diálogo e lê a execução de novo', async () => {
    api.respond(GET, json(withId({ status: 'delivering' })), json(finished()));
    api.respond(CANCEL, problem(409, 'execution_finished'));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar execução' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));
    expect(await within(dialog).findByText(/A execução terminou antes do pedido de cancelamento/)).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
  });

  it('sem executions.trigger ou com a execução terminada, Cancelar não aparece', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(GET, json(withId({ status: 'calculating' })));
    const { queryClient } = renderPanel();
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
  });

  it('com a execução terminada, Cancelar não aparece', async () => {
    api.respond(GET, json(finished()));
    const { queryClient } = renderPanel();
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
  });
});

describe('Painel da execução: atualização', () => {
  it('pede a execução de novo a cada 2 s e para no estado final', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api.respond(
      GET,
      json(withId({ status: 'calculating', total_records: 100, progress: { chunks_done: 1, records_done: 40 } })),
      json(withId({ status: 'calculating', total_records: 100, progress: { chunks_done: 2, records_done: 80 } })),
      json(finished({ total_records: 100, progress: { chunks_done: 3, records_done: 100 } })),
    );
    renderPanel();
    expect(await screen.findByText('40 de 100 registros · 40%')).toBeInTheDocument();
    expect(api.callsTo(GET)).toHaveLength(1);
    const recordsBefore = api.callsTo(RECORDS).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(api.callsTo(GET)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(await screen.findByText('80 de 100 registros · 80%')).toBeInTheDocument();
    // A new chunk brings new records: the list is read again.
    await waitFor(() => expect(api.callsTo(RECORDS).length).toBeGreaterThan(recordsBefore));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
    expect(api.callsTo(GET)).toHaveLength(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.callsTo(GET)).toHaveLength(3);
  });

  const failures: [string, () => Response | Promise<Response>, RegExp][] = [
    ['403 no_permission', () => problem(403, 'no_permission'), /não tem permissão para ver as execuções/],
    ['404 not_found', () => problem(404, 'not_found'), /Esta execução não existe neste tenant/],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch')), /Não foi possível falar com o servidor/],
  ];

  it.each(failures)('%s no meio da atualização: avisa, mantém os dados e para de pedir', async (_name, failure, message) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api.respond(
      GET,
      json(withId({ status: 'calculating', total_records: 100, progress: { chunks_done: 1, records_done: 40 } })),
      failure,
      json(withId({ status: 'calculating', total_records: 100, progress: { chunks_done: 2, records_done: 80 } })),
    );
    const { user } = renderPanel();
    expect(await screen.findByText('40 de 100 registros · 40%')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(await screen.findByText('Não foi possível atualizar a execução')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    // The last data stays on screen.
    expect(screen.getByText('40 de 100 registros · 40%')).toBeInTheDocument();
    expect(api.callsTo(GET)).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.callsTo(GET)).toHaveLength(2);

    // "Tentar de novo" reads it again and the update starts over.
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('80 de 100 registros · 80%')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível atualizar a execução')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(4));
  });
});

describe('Painel da execução: registros e gaveta (casos de borda)', () => {
  const COMPARISON = `GET /v1/executions/${ID}/comparison/records`;
  const failedSummary = summary({ result_key: 'b'.repeat(64), record_key: { nf_id: '11', item_seq: '1' }, status: 'error', error_node_id: 'calc_pontos', error_code: 'division_by_zero' });
  const regionOf = () => screen.getByRole('heading', { level: 2, name: 'Registros' });
  /** The always-mounted status region of the records, read by the screen reader. */
  const announcement = () => document.querySelector('.fc-records > p[role="status"]');

  it('"Carregar mais registros" some na última página: o foco vai para o título dos registros, não para o body', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      json({ items: [summary({ result_key: 'c'.repeat(64), record_key: { nf_id: '20', item_seq: '1' } })], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Carregar mais registros' }));
    expect(await screen.findByText('nf_id 20 · item_seq 1')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Carregar mais registros' })).not.toBeInTheDocument());
    await waitFor(() => expect(regionOf()).toHaveFocus());
  });

  it('o fim das páginas por troca de filtro não leva o foco ao título dos registros (nem rola a tela)', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, (request) =>
      json({ items: [summary()], next_cursor: queryOf(request).has('status') ? null : 'c2' }),
    );
    const { user } = renderPanel();
    expect(await screen.findByRole('button', { name: 'Carregar mais registros' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'erro' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Carregar mais registros' })).not.toBeInTheDocument());
    expect(regionOf()).not.toHaveFocus();
  });

  it('uma região de status sempre montada anuncia a página, a troca de filtro e o "Nenhum registro"', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      json({ items: [summary({ result_key: 'c'.repeat(64), record_key: { nf_id: '20', item_seq: '1' } })], next_cursor: null }),
      json({ items: [], next_cursor: null }),
    );
    const { user } = renderPanel();

    await screen.findByText('nf_id 10 · item_seq 1');
    await waitFor(() => expect(announcement()).toHaveTextContent('Mais de 1 registros'));
    await user.click(screen.getByRole('button', { name: 'Carregar mais registros' }));
    await waitFor(() => expect(announcement()).toHaveTextContent('2 registros'));

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'filtrado' }));
    await waitFor(() => expect(announcement()).toHaveTextContent('Nenhum registro'));
  });

  it('o erro da primeira página também é anunciado', async () => {
    api.respond(GET, json(finished()));
    api.respond(RECORDS, problem(500, 'internal_error'));
    renderPanel();

    await screen.findByText('Não foi possível carregar os registros', { selector: '.fc-notice-title' });
    await waitFor(() => expect(announcement()).toHaveTextContent('Não foi possível carregar os registros'));
  });

  it('invalid_data do filtro: "Ver as divergências" volta ao filtro padrão', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: null }),
      problem(422, 'invalid_data'),
      json({ items: [summary(), failedSummary], next_cursor: null }),
    );
    const { user } = renderPanel();
    await screen.findByText('nf_id 10 · item_seq 1');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'filtrado' }));
    expect(await screen.findByText(/A API recusou o filtro escolhido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver as divergências' }));
    expect(await screen.findByText('nf_id 11 · item_seq 1')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).getAll('status')).toEqual([]);
  });

  it('a resposta tardia da página seguinte de um filtro antigo não entra na lista do filtro novo', async () => {
    api.respond(GET, json(finished()));
    let releaseLate: (response: Response) => void = () => {};
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      () => new Promise<Response>((resolve) => (releaseLate = resolve)),
      json({ items: [failedSummary], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Carregar mais registros' }));
    await waitFor(() => expect(api.callsTo(RECORDS)).toHaveLength(2));
    expect(queryOf(api.callsTo(RECORDS)[1]!).get('cursor')).toBe('c2');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'erro' }));
    expect(await screen.findByText('nf_id 11 · item_seq 1')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).has('cursor')).toBe(false);

    await act(async () => releaseLate(json({ items: [summary({ result_key: 'd'.repeat(64), record_key: { nf_id: '30', item_seq: '1' } })], next_cursor: null })));
    expect(screen.queryByText('nf_id 30 · item_seq 1')).not.toBeInTheDocument();
    expect(screen.getByText('nf_id 11 · item_seq 1')).toBeInTheDocument();
  });

  it('invalid_cursor na página seguinte: "Recarregar registros" lê a lista desde o início', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      problem(422, 'invalid_cursor'),
      json({ items: [summary({ record_key: { nf_id: '40', item_seq: '1' } })], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Carregar mais registros' }));
    expect(await screen.findByText(/Não foi possível continuar de onde a lista parou/)).toBeInTheDocument();
    expect(screen.getByText('nf_id 10 · item_seq 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recarregar registros' }));
    expect(await screen.findByText('nf_id 40 · item_seq 1')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).has('cursor')).toBe(false);
  });

  it('erro em "Carregar mais": avisa, mantém as linhas e "Tentar de novo" pede a mesma página', async () => {
    api.respond(GET, json(finished()));
    api.respond(
      RECORDS,
      json({ items: [summary()], next_cursor: 'c2' }),
      problem(500, 'internal_error'),
      json({ items: [summary({ result_key: 'c'.repeat(64), record_key: { nf_id: '20', item_seq: '1' } })], next_cursor: null }),
    );
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Carregar mais registros' }));
    expect(await screen.findByText('Não foi possível carregar mais registros')).toBeInTheDocument();
    expect(screen.getByText('nf_id 10 · item_seq 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('nf_id 20 · item_seq 1')).toBeInTheDocument();
    expect(queryOf(api.callsTo(RECORDS).at(-1)!).get('cursor')).toBe('c2');
  });

  it('só com simulations.run (sem traces.view), a simulação não mostra os registros, mas a gaveta abre pela comparação com a definição', async () => {
    api = simulateApi(['workflows.view', 'executions.view', 'simulations.run']);
    api.respond(
      GET,
      json(
        finished({
          mode: 'simulation',
          output: { available: false, expires_at: null, rows: null },
          reference_file: { id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e1f', name: 'esperado.csv' },
          comparison: { compared: 1, equal: 0, different: 1, status_differs: 0, missing_from_result: 0, missing_from_file: 0, not_compared: 0, equal_percent: '0.00' },
        }),
      ),
    );
    api.respond(
      COMPARISON,
      json({
        items: [
          {
            result_key: RESULT_KEY,
            record_key: { nf_id: '10', item_seq: '1' },
            outcome: 'different',
            expected_status: null,
            obtained_status: 'ok',
            fields: [{ name: 'pontos', expected: '1500.00', obtained: '1250.5' }],
          },
        ],
        next_cursor: null,
      }),
    );
    api.respond(RECORD, json(storedRecord('standard')));
    api.respond(DEFINITION_ROUTE, json(FROZEN));
    const renderRecordTrace = vi.fn(({ definition }: { definition: Schemas['WorkflowDefinition'] }) => <p>{`definição de ${definition.root.nodes.length} bloco`}</p>);
    const { user, queryClient } = renderPanel({ renderRecordTrace });

    const open = await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' });
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('heading', { level: 2, name: 'Registros' })).not.toBeInTheDocument();
    expect(api.callsTo(RECORDS)).toHaveLength(0);

    await user.click(open);
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    expect(await within(drawer).findByText('definição de 1 bloco')).toBeInTheDocument();
  });
});

describe('Painel da execução: listas de definição', () => {
  it('as listas <dl> do resumo não levam aria-label (o nome fica na seção)', async () => {
    api.respond(GET, json(finished()));
    renderPanel();

    const summary = await screen.findByRole('region', { name: 'Resumo' });
    expect(summary.querySelectorAll('dl')).toHaveLength(2);
    expect(summary.querySelectorAll('dl[aria-label]')).toHaveLength(0);
  });
});
