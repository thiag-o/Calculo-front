import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import {
  DRAFT,
  DRAFT_WITH_SOURCES,
  NO_MATCH_MESSAGE,
  PREVIEW,
  PROBLEM,
  RUN_ROUTE,
  SAVE_ROUTE,
  TRACE_CAMPAIGN,
  TRACE_ERROR,
  TRACE_FILTERED,
  TRACE_IGNORED,
  TRACE_OK,
  TRACE_SCHEMA_DRIFT,
  TRACE_WARNINGS,
  WORKFLOW_ID,
  json,
  problem,
  renderTab,
  simulateApi,
  testQueryClient,
  type SimulatedApi,
} from './unit-run.test-support';

// The last preview of each workflow comes from the "Prévia" tab (useLastPreview, D25); here it is set by the test.
const lastPreviews = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../preview', () => ({ useLastPreview: (workflowId: string) => lastPreviews.get(workflowId) ?? null }));

/** The "Prévia" tab ran a preview of the workflow (the definition that ran is the draft's). */
function previewRan(preview: Schemas['Preview'], workflowId = WORKFLOW_ID) {
  lastPreviews.set(workflowId, { revision: DRAFT_WITH_SOURCES.revision, definition: DRAFT_WITH_SOURCES.definition, preview });
}

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  api.respond(`GET /v1/workflows/${WORKFLOW_ID}/draft`, json(DRAFT_WITH_SOURCES));
});

afterEach(() => {
  cleanup();
  lastPreviews.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calculate = () => screen.getByRole('button', { name: 'Calcular' });
const keyField = (name: string) => screen.getByRole('textbox', { name });

function renderRecordTab(options: Parameters<typeof renderTab>[0] = {}) {
  return renderTab({ draft: DRAFT_WITH_SOURCES, ...options });
}

async function typeKey(user: ReturnType<typeof renderTab>['user'], nfId: string, itemSeq: string) {
  await user.click(keyField('nf_id'));
  await user.paste(nfId);
  await user.click(keyField('item_seq'));
  await user.paste(itemSeq);
}

/** Calculates the record nf_id 10 · item_seq 1 with the trace given. */
async function calculateTrace(trace: Schemas['UnitRunTrace']) {
  api.respond(RUN_ROUTE, json(trace));
  const screenOf = renderRecordTab();
  await typeKey(screenOf.user, '10', '1');
  await screenOf.user.click(calculate());
  await screen.findByRole('heading', { name: 'Resultado' });
  return screenOf;
}

describe('aba Calcular com fonte do lote: escolher registro', () => {
  it('troca o formulário das entradas pelos campos da chave', () => {
    renderRecordTab();
    expect(screen.getByRole('heading', { name: 'Escolher registro' })).toBeInTheDocument();
    const key = screen.getByRole('group', { name: 'Chave do registro' });
    expect(within(key).getByRole('textbox', { name: 'nf_id' })).toHaveAccessibleDescription('Texto');
    expect(within(key).getByRole('textbox', { name: 'item_seq' })).toHaveAccessibleDescription('Número inteiro');
    expect(screen.queryByRole('heading', { name: 'Valores' })).not.toBeInTheDocument();
    expect(screen.getByText('Rode a prévia para escolher um registro da amostra, ou digite a chave.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum cálculo ainda')).toBeInTheDocument();
  });

  it('pela chave digitada: envia a chave do registro, como texto, e mostra o registro no resultado', async () => {
    await calculateTrace(TRACE_OK);
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 4, record_key: { nf_id: '10', item_seq: '1' }, parameters: {} }]);
    expect(screen.getByText('nf_id 10 · item_seq 1', { selector: '.fc-unit-run-record .fc-unit-run-name' })).toBeInTheDocument();
  });

  it('o número da chave é digitado no padrão brasileiro e vai com ponto', async () => {
    api.respond(RUN_ROUTE, json(TRACE_OK));
    const { user } = renderRecordTab();
    await typeKey(user, '10', '1.500');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 4, record_key: { nf_id: '10', item_seq: '1500' }, parameters: {} }]);
  });

  it('chave incompleta: não envia e diz no campo o que falta', async () => {
    const { user } = renderRecordTab();
    await user.click(keyField('nf_id'));
    await user.paste('10');
    await user.click(calculate());
    expect(keyField('item_seq')).toHaveAccessibleDescription(expect.stringContaining('Digite o valor de item_seq.'));
    expect(keyField('item_seq')).toHaveFocus();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('pela amostra da última prévia: escolher um registro preenche a chave, e Calcular roda ele', async () => {
    api.respond(RUN_ROUTE, json(TRACE_FILTERED));
    previewRan(PREVIEW);
    const { user } = renderRecordTab();

    const sample = screen.getByRole('list', { name: 'Amostra da última prévia' });
    // Only the records of the root group: those of a group are not records of the batch source.
    expect(within(sample).getAllByRole('button')).toHaveLength(2);
    const filtered = within(sample).getByRole('button', { name: 'Escolher nf_id 10 · item_seq 1500 (filtrado na prévia)' });
    expect(filtered).toHaveAttribute('aria-pressed', 'false');

    await user.click(filtered);

    expect(keyField('nf_id')).toHaveValue('10');
    expect(keyField('item_seq')).toHaveValue('1.500');
    expect(filtered).toHaveAttribute('aria-pressed', 'true');
    expect(within(sample).getByRole('button', { name: /item_seq 1 \(ok/ })).toHaveAttribute('aria-pressed', 'false');

    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 4, record_key: { nf_id: '10', item_seq: '1500' }, parameters: {} }]);
  });

  it('a amostra de uma prévia com outra chave não é oferecida', async () => {
    const otherKey: Schemas['Preview'] = {
      ...PREVIEW,
      groups: [{ node_id: null, records: [{ record_key: { nf_id: '10' }, status: 'ok', inputs: {}, outputs: {} }] }],
    };
    previewRan(otherKey);
    renderRecordTab();
    expect(screen.queryByRole('list', { name: 'Amostra da última prévia' })).not.toBeInTheDocument();
    expect(screen.getByText('Rode a prévia para escolher um registro da amostra, ou digite a chave.')).toBeInTheDocument();
  });

  it('só a prévia do workflow aberto oferece a amostra', () => {
    previewRan(PREVIEW, '00000000-0000-4000-8000-000000000000');
    renderRecordTab();
    expect(screen.queryByRole('list', { name: 'Amostra da última prévia' })).not.toBeInTheDocument();
  });

  it('uma prévia com erro de leitura (sem registros) não deixa amostra', () => {
    previewRan({ ...PREVIEW, groups: [] });
    renderRecordTab();
    expect(screen.queryByRole('list', { name: 'Amostra da última prévia' })).not.toBeInTheDocument();
  });

  it('a chave digitada fica na memória, separada dos valores das entradas', async () => {
    const queryClient = testQueryClient();
    const first = renderRecordTab({ queryClient });
    await typeKey(first.user, '10', '1');
    first.unmount();

    renderRecordTab({ queryClient });
    expect(keyField('nf_id')).toHaveValue('10');
    expect(keyField('item_seq')).toHaveValue('1');
    cleanup();

    renderTab({ draft: DRAFT, queryClient });
    expect(screen.getByRole('textbox', { name: 'valor_item' })).toHaveValue('');
  });

  it('salva o rascunho pendente antes de rodar e roda a revisão salva', async () => {
    api.respond(SAVE_ROUTE, json({ ...DRAFT_WITH_SOURCES, revision: 5 }));
    api.respond(RUN_ROUTE, json(TRACE_OK));
    const { user } = renderRecordTab();
    await user.click(screen.getByRole('button', { name: 'Renomear Pontos' }));
    await typeKey(user, '10', '1');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.routes().filter((route) => route === SAVE_ROUTE)).toHaveLength(1);
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 5, record_key: { nf_id: '10', item_seq: '1' }, parameters: {} }]);
  });

  it('fica desabilitado com o motivo enquanto houver problema', () => {
    renderRecordTab({ draft: { ...DRAFT_WITH_SOURCES, problems: [PROBLEM] } });
    expect(calculate()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Resolva 1 problema para calcular')).toBeInTheDocument();
  });

  it('marca o resultado de outro registro quando a chave muda depois do cálculo', async () => {
    const { user } = await calculateTrace(TRACE_OK);
    const stale = 'Resultado de outro registro. Calcule de novo para ver o do registro escolhido.';
    expect(screen.queryByText(stale)).not.toBeInTheDocument();
    await user.clear(keyField('item_seq'));
    await user.paste('2');
    expect(screen.getByText(stale)).toBeInTheDocument();
  });
});

describe('aba Calcular com fonte do lote: record_not_found', () => {
  it('diz no campo da chave que não há registro, com o foco nele, e some ao editar', async () => {
    api.respond(RUN_ROUTE, problem(404, 'record_not_found'));
    const { user } = renderRecordTab();
    await typeKey(user, '77', '1');
    await user.click(calculate());

    await waitFor(() => expect(keyField('nf_id')).toHaveAccessibleDescription(expect.stringContaining('Nenhum registro com essa chave.')));
    expect(keyField('nf_id')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(keyField('nf_id')).toHaveFocus());
    expect(screen.getByText('Registro não encontrado')).toBeInTheDocument();

    await user.paste('0');
    expect(screen.queryByText('Nenhum registro com essa chave.')).not.toBeInTheDocument();
  });
});

describe('aba Calcular: o trace', () => {
  it('Entradas: o valor e a origem (conexão › dataset › coluna e a chave da linha) de cada uma', async () => {
    await calculateTrace(TRACE_OK);
    const inputs = within(screen.getByRole('region', { name: 'Entradas' })).getAllByRole('listitem');
    expect(inputs).toHaveLength(4);
    expect(inputs[1]).toHaveTextContent('valor_item');
    expect(inputs[1]).toHaveTextContent('1.500,00');
    expect(inputs[1]).toHaveTextContent('ERP › Itens NF › vl_itm');
    expect(inputs[1]).toHaveTextContent('nf_id 10 · item_seq 1');
    expect(inputs[2]).toHaveTextContent('Cadastro › Produtos › categoria');
    expect(inputs[2]).toHaveTextContent('cod_prod P-001');
    // An Excel dataset has no connection.
    expect(inputs[3]).toHaveTextContent('Cotações.xlsx › cotacao');
    expect(inputs[3]).not.toHaveTextContent('›  ›');
  });

  it('trace real da campanha: a tabela de parâmetros sem chave da linha e o grupo sem values desenham o resultado', async () => {
    const { user } = await calculateTrace(TRACE_CAMPAIGN);
    expect(screen.getByText('Resultado do cálculo: ok')).toBeInTheDocument();
    const inputs = within(screen.getByRole('region', { name: 'Entradas' })).getAllByRole('listitem');
    const parameters = inputs.at(-1)!;
    expect(parameters).toHaveTextContent('teto_pontos_item');
    // Not a symbol of this draft: the value goes as the API sent it.
    expect(parameters).toHaveTextContent('150.00');
    expect(parameters).toHaveTextContent('ERP › Parâmetros › teto_pontos_item');
    expect(parameters).not.toHaveTextContent('chave da linha');
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copiar teto_pontos_item' }));
    expect(write).toHaveBeenCalledWith('teto_pontos_item = 150.00 · ERP › Parâmetros › teto_pontos_item');
    // The group has Input, Output and the blocks inside, without values of its own.
    expect(screen.getByLabelText('Output de Pontuação')).toHaveTextContent('pontos225,00');
    expect(within(screen.getByRole('region', { name: 'Saídas' })).getByText('pontos').nextSibling).toHaveTextContent('225,00');
  });

  it('Entradas são copiáveis: o botão copia o valor com a origem', async () => {
    const { user } = await calculateTrace(TRACE_OK);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copiar valor_item' }));
    expect(write).toHaveBeenCalledWith('valor_item = 1.500,00 · ERP › Itens NF › vl_itm · nf_id 10 · item_seq 1');
    expect(screen.getByText('valor_item copiado')).toBeInTheDocument();
  });

  it('se a cópia falhar, diz como copiar à mão', async () => {
    const { user } = await calculateTrace(TRACE_OK);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    await user.click(screen.getByRole('button', { name: 'Copiar nf_id' }));
    expect(await screen.findByText('Não foi possível copiar nf_id. Selecione o texto e copie com Ctrl C.')).toBeInTheDocument();
  });

  it('Saída e os hashes, encurtados, com a cópia do hash inteiro', async () => {
    const { user } = await calculateTrace(TRACE_OK);
    const outputs = screen.getByRole('region', { name: 'Saídas' });
    expect(within(outputs).getByText('pontos').nextSibling).toHaveTextContent('225,00');
    const hashList = within(outputs).getByLabelText('Hashes');
    expect(hashList).toHaveTextContent('Hash das entradas');
    expect(hashList).toHaveTextContent('sha256:77b0db21bf50…');
    expect(hashList).not.toHaveTextContent(TRACE_OK.input_hash);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(hashList).getByRole('button', { name: 'Copiar hash da saída' }));
    expect(write).toHaveBeenCalledWith(TRACE_OK.output_hash);
  });

  it('Blocos aninhados por grupo: o grupo com Input, Output e os blocos de dentro, com a regra e as linhas achadas', async () => {
    const { user } = await calculateTrace(TRACE_OK);
    const blocks = screen.getByRole('region', { name: 'Blocos' });
    const top = within(blocks).getAllByRole('list')[0]!;
    const [source, group] = Array.from(top.children) as HTMLElement[];
    expect(top.children).toHaveLength(2);
    expect(source).toHaveTextContent('Produto');
    expect(source).toHaveTextContent('1 linha encontrada');
    expect(within(source!).getByText('categoria').nextSibling).toHaveTextContent('A');

    expect(group).toHaveTextContent('Pontuação');
    expect(within(group!).getByLabelText('Input de Pontuação')).toHaveTextContent('valor_item1.500,00');
    expect(within(group!).getByLabelText('Output de Pontuação')).toHaveTextContent('pontos225,00');
    const inside = within(group!).getByRole('list', { name: 'Blocos de Pontuação' });
    const [table, calc] = within(inside).getAllByRole('listitem');
    expect(table).toHaveTextContent('Elegibilidade');
    expect(table).toHaveTextContent('Regra 1');
    expect(within(table!).getByText('fator').nextSibling).toHaveTextContent('0,1500');
    expect(calc).toHaveTextContent('Pontos');

    // A block inside a group is selected in the canvas too.
    await user.click(within(inside).getByRole('button', { name: 'Pontos: selecionar no canvas' }));
    expect(screen.getByRole('status', { name: 'Seleção' })).toHaveTextContent('node:calc_pontos');
  });

  it('o erro de um bloco dentro do grupo fica no bloco, e o resto do grupo não rodou', async () => {
    await calculateTrace(TRACE_ERROR);
    const inside = screen.getByRole('list', { name: 'Blocos de Pontuação' });
    const [table, calc] = within(inside).getAllByRole('listitem');
    expect(table).toHaveTextContent('no_rule_matched');
    expect(table).toHaveTextContent('Nenhuma regra casou com os valores do registro.');
    expect(calc).toHaveTextContent('não rodado');
    expect(calc).toHaveClass('fc-unit-run-node-not-run');
    // The record's error is the block's: not repeated at the top.
    expect(screen.getAllByText('Nenhuma regra casou com os valores do registro.')).toHaveLength(1);
    expect(screen.getByText('Sem saídas: o registro deu erro.')).toBeInTheDocument();
  });

  it.each([
    ['ok', TRACE_OK, 'ok', 'fc-status-green'],
    ['ok_with_warnings', TRACE_WARNINGS, 'com avisos', 'fc-status-amber'],
    ['error', TRACE_ERROR, 'erro', 'fc-status-red'],
    ['ignored', TRACE_IGNORED, 'ignorado', 'fc-status-gray'],
    ['filtered', TRACE_FILTERED, 'filtrado', 'fc-status-multi'],
  ] as const)('status %s: ponto e palavra "%s"', async (_status, trace, word, tone) => {
    await calculateTrace(trace);
    expect(screen.getByText(`Resultado do cálculo: ${word}`)).toBeInTheDocument();
    const head = screen.getByRole('heading', { name: 'Resultado' }).parentElement!;
    const status = head.querySelector('.fc-status')!;
    expect(status).toHaveTextContent(word);
    expect(status).toHaveClass(tone);
  });

  it('ignorado: o motivo no bloco Fonte, sem repetir no registro, e sem saídas', async () => {
    await calculateTrace(TRACE_IGNORED);
    const source = within(screen.getByRole('region', { name: 'Blocos' })).getAllByRole('listitem')[0]!;
    expect(source).toHaveTextContent('Nenhuma linha encontrada');
    expect(within(source).getByRole('list', { name: 'Avisos de Produto' })).toHaveTextContent(NO_MATCH_MESSAGE);
    expect(screen.queryByRole('list', { name: 'Avisos do registro' })).not.toBeInTheDocument();
    expect(screen.getByText('Sem saídas: o registro foi ignorado.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Hashes')).getByText('Hash da saída').nextSibling).toHaveTextContent('—');
  });

  it('filtrado: o registro fora do filtro, sem saídas, e o grupo não rodado', async () => {
    await calculateTrace(TRACE_FILTERED);
    expect(screen.getByText('Sem saídas: o registro foi filtrado.')).toBeInTheDocument();
    const group = within(screen.getByRole('region', { name: 'Blocos' })).getAllByRole('listitem')[1]!;
    expect(group).toHaveTextContent('não rodado');
  });

  it('com avisos: as linhas achadas e o aviso no bloco Fonte', async () => {
    await calculateTrace(TRACE_WARNINGS);
    const source = within(screen.getByRole('region', { name: 'Blocos' })).getAllByRole('listitem')[0]!;
    expect(source).toHaveTextContent('3 linhas encontradas');
    expect(source).toHaveTextContent('multiple_rows');
  });

  it('erro de leitura da fonte do lote: a mensagem com o código, no registro', async () => {
    await calculateTrace(TRACE_SCHEMA_DRIFT);
    expect(screen.getByText('schema_drift')).toBeInTheDocument();
    expect(screen.getByText('Fonte do lote: `ItensNF.vl_itm` não existe mais na origem.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum bloco rodou.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Entradas' })).not.toBeInTheDocument();
  });

  it('o carregando enquanto calcula', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(RUN_ROUTE, () => new Promise<Response>((resolve) => (release = resolve)));
    const { user } = renderRecordTab();
    await typeKey(user, '10', '1');
    await user.click(calculate());
    expect(await screen.findByText('Calculando')).toBeInTheDocument();
    await waitFor(() => expect(api.bodiesTo(RUN_ROUTE)).toHaveLength(1));
    await act(async () => release(json(TRACE_OK)));
    await screen.findByRole('heading', { name: 'Resultado' });
  });
});

describe('aba Calcular sem fonte do lote', () => {
  it('continua com o formulário das entradas, e o trace diz que os valores foram digitados', async () => {
    api.respond(RUN_ROUTE, json({ ...TRACE_OK, record_key: null, inputs: [{ variable: 'valor_item', value: '10.00', origin: null }] }));
    const { user } = renderTab({ draft: DRAFT });
    expect(screen.getByRole('heading', { name: 'Valores' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Escolher registro' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await user.paste('10');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    const [input] = within(screen.getByRole('region', { name: 'Entradas' })).getAllByRole('listitem');
    expect(input).toHaveTextContent('valor_item');
    expect(input).toHaveTextContent('10,00');
    expect(input).toHaveTextContent('Digitado');
    expect(api.bodiesTo(RUN_ROUTE)[0]).toMatchObject({ revision: 3, inputs: { valor_item: '10' } });
  });
});
