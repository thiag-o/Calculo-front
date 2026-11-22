import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../api';
// The layout React Flow needs in jsdom (sets up the browser features as a side effect).
import './canvas/canvas.test-support';
import { ITEMS_DATASET, GOALS_DATASET } from './sources/batch-source/batch-source.test-support';
import { DRAFT as CAMPAIGN, PREVIEW, PREVIEW_ROUTE } from './preview/preview.test-support';
import { nestedDraft } from './groups/groups.test-support';
import { RUN_ROUTE } from './unit-run/unit-run.test-support';
import type { FormulaEditorProps } from '../formula';
import { Editor } from '.';
import {
  ANALYSIS_ROUTE,
  DRAFT_ROUTE,
  EDITOR_PERMISSIONS,
  SAVE_ROUTE,
  VIEWER_PERMISSIONS,
  json,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './draft/editor.test-support';

// The editor with the epic 5 pieces, by role: the batch source, the Fonte block and the group in Propriedades, the Fonte
// and Agrupar buttons, the Prévia tab, Calcular by record and the values on the canvas. The draft is the reference campaign
// (batch source of the invoice items, three Fonte blocks and the "Pontuação" group with a Calculation inside).

// The Monaco editor has its own tests (F52); here a plain field stands for it. The rest of the vertical stays (the filter
// values read the run parameters through it, F99).
vi.mock('../formula', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../formula')>()),
  FormulaEditor: ({ value, onChange, readOnly, 'aria-label': label }: FormulaEditorProps) => (
    <textarea aria-label={label} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />
  ),
}));

const SLOW = { timeout: 4000 };
const WORKFLOW_ID = CAMPAIGN.workflow_id;
const ITEMS_ID = CAMPAIGN.definition.root.batch_source!.dataset_id;
const ITEMS = { ...ITEMS_DATASET, id: ITEMS_ID, name: 'Itens da nota' };
const GOALS = { ...GOALS_DATASET, name: 'Metas por loja' };
const VARIABLES: Record<string, Schemas['Variable'][]> = {
  [ITEMS_ID]: ['nf_id', 'item_seq', 'cod_prod', 'valor_item', 'data_emissao'].map((name, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    dataset_id: ITEMS_ID,
    column: name,
    name,
    type: name === 'valor_item' ? 'decimal' : name === 'cod_prod' ? 'text' : name === 'data_emissao' ? 'date' : 'integer',
    scale: name === 'valor_item' ? 2 : null,
  })),
  [GOALS.id]: [
    { id: '00000000-0000-4000-8000-000000000101', dataset_id: GOALS.id, column: 'loja', name: 'loja', type: 'text', scale: null },
    { id: '00000000-0000-4000-8000-000000000102', dataset_id: GOALS.id, column: 'meta', name: 'meta', type: 'decimal', scale: 2 },
  ],
};

let api: SimulatedApi;
let saved: Schemas['WorkflowDefinition'][];

/** The API of the campaign: the draft, its analysis and save, the catalog, the preview and, as a given, the unit run. */
function simulateCampaign(permissions: readonly string[]) {
  saved = [];
  api = simulateApi(permissions);
  api.respond(DRAFT_ROUTE, json(CAMPAIGN));
  api.respond(
    ANALYSIS_ROUTE,
    json({ problems: [], symbols: CAMPAIGN.symbols, dependencies: CAMPAIGN.dependencies, order: CAMPAIGN.order, groups: CAMPAIGN.groups }),
  );
  api.respond(SAVE_ROUTE, async (request) => {
    const body = (await request.clone().json()) as { definition: Schemas['WorkflowDefinition'] };
    saved.push(body.definition);
    return json({ ...CAMPAIGN, revision: CAMPAIGN.revision + saved.length, definition: body.definition });
  });
  api.respond('GET /v1/datasets', json({ items: [ITEMS, GOALS] }));
  for (const [id, items] of Object.entries(VARIABLES)) api.respond(`GET /v1/datasets/${id}/variables`, json({ items }));
  api.respond(PREVIEW_ROUTE, json(PREVIEW));
}

beforeEach(() => {
  simulateCampaign(EDITOR_PERMISSIONS);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open() {
  return renderScreen(<Editor workflowId={WORKFLOW_ID} onBack={vi.fn()} />);
}

const region = () => screen.findByRole('region', { name: 'Editor de Pontuação de exemplo' }, SLOW);
const tabNames = (editor: HTMLElement) => within(editor).getAllByRole('tab').map((tab) => tab.textContent);
// user-event sends the mouse events with `view` null, and React Flow's drag (d3) needs the window there: the canvas nodes
// get the click itself (`fireEvent.click`, as in the canvas tests).
const node = (name: string | RegExp) => screen.findByRole('group', { name }, SLOW);

describe('Editor, o Configurador monta fontes e grupos', () => {
  it('a barra Fonte do lote aparece no lugar das Entradas e, selecionada, abre as propriedades dela com os filtros', async () => {
    const { user } = open();
    const editor = await region();

    const bar = await node('Fonte do lote');
    expect(within(bar).getByText(/Itens da nota/)).toBeInTheDocument();
    expect(within(within(bar).getByRole('list', { name: 'Variáveis da fonte do lote' })).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('group', { name: 'Entradas' })).not.toBeInTheDocument();
    // The layers call the same item "Fonte do lote", with the variables under it.
    expect(within(editor).getByRole('treeitem', { name: /^Fonte do lote/ })).toBeInTheDocument();

    fireEvent.click(bar);
    expect(await within(editor).findByRole('heading', { name: 'Fonte do lote' }, SLOW)).toBeInTheDocument();
    // The filters of the batch source are the filters component of the Source block.
    // The batch source wraps the list in a "Filtros" part, and the list is a "Filtros" group of its own: the inner one is last.
    const filters = (await within(editor).findAllByRole('group', { name: 'Filtros' }, SLOW)).at(-1)!;
    await waitFor(() => expect(within(filters).getByRole('button', { name: 'Incluir filtro' })).toBeEnabled());
    await user.click(within(filters).getByRole('button', { name: 'Incluir filtro' }));
    expect(await within(editor).findByRole('group', { name: 'Filtro 1' })).toBeInTheDocument();
  });

  it('o bloco Fonte, o grupo e o Cálculo de dentro do grupo abrem cada um as próprias propriedades', async () => {
    open();
    const editor = await region();

    fireEvent.click(await node(/^Produtos, Fonte Linear/));
    expect(await within(editor).findByRole('heading', { name: 'Fonte' }, SLOW)).toBeInTheDocument();

    fireEvent.click(await node(/^Pontuação, Grupo/));
    expect(await within(editor).findByRole('heading', { name: 'Grupo' }, SLOW)).toBeInTheDocument();
    expect(within(editor).getByRole('list', { name: 'Input do grupo' })).toHaveTextContent('fator');

    // A Calculation inside the group: found at any depth, edited in place and saved inside the group.
    fireEvent.click(await node(/^Pontos, Cálculo/));
    expect(await within(editor).findByRole('heading', { name: 'Cálculo' }, SLOW)).toBeInTheDocument();
    fireEvent.change(within(editor).getByRole('textbox', { name: /^Nome do bloco/ }), { target: { value: 'Pontos do item' } });
    await node(/^Pontos do item, Cálculo/);
    await waitFor(() => {
      const group = saved.at(-1)?.root.nodes.find((candidate) => candidate.id === 'grp_pontuacao');
      expect(group?.type === 'group' ? group.nodes[0]?.name : null).toBe('Pontos do item');
    }, SLOW);
  });

  it('uma Tabela de Decisão dentro de um grupo dentro de outro abre as propriedades e a grade, e edita no lugar', async () => {
    const nested = nestedDraft();
    api.respond(DRAFT_ROUTE, json(nested));
    api.respond(
      ANALYSIS_ROUTE,
      json({ problems: [], symbols: nested.symbols, dependencies: nested.dependencies, order: nested.order, groups: nested.groups }),
    );
    api.respond(SAVE_ROUTE, async (request) => {
      const body = (await request.clone().json()) as { definition: Schemas['WorkflowDefinition'] };
      saved.push(body.definition);
      return json({ ...nested, revision: nested.revision + saved.length, definition: body.definition });
    });
    const { user } = open();
    const editor = await region();

    fireEvent.click(await node(/^Elegibilidade, Tabela de Decisão/));
    const name = await within(editor).findByRole('textbox', { name: 'Nome' }, SLOW);
    fireEvent.change(name, { target: { value: 'Elegível' } });
    fireEvent.blur(name);
    await node(/^Elegível, Tabela de Decisão/);
    await waitFor(() => {
      const campanha = saved.at(-1)?.root.nodes[0];
      const grupo = campanha?.type === 'group' ? campanha.nodes[0] : null;
      expect(grupo?.type === 'group' ? grupo.nodes[0]?.name : null).toBe('Elegível');
    }, SLOW);

    await user.click(await within(editor).findByRole('button', { name: 'Abrir tabela' }, SLOW));
    expect(await within(editor).findByRole('region', { name: 'Tabela de Decisão Elegível' }, SLOW)).toBeInTheDocument();
  });

  it('a barra de ferramentas inclui uma Fonte pelo dataset do catálogo, com as variáveis dele', async () => {
    const { user } = open();
    const editor = await region();

    await user.click(await within(editor).findByRole('button', { name: 'Fonte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Incluir bloco Fonte' }, SLOW);
    await user.click(await within(dialog).findByRole('button', { name: /Metas por loja/ }, SLOW));
    expect(await within(dialog).findByText('Metas por loja · 2 variáveis', undefined, SLOW)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Incluir Fonte' }));

    // The block is on the canvas, selected, with its own properties; the draft gets it with the contract's shape.
    await node(/^Fonte 1, Fonte Linear/);
    expect(await within(editor).findByRole('heading', { name: 'Fonte' }, SLOW)).toBeInTheDocument();
    await waitFor(() => {
      const added = saved.at(-1)?.root.nodes.find((candidate) => candidate.id === 'src_1');
      expect(added).toMatchObject({
        type: 'source',
        mode: 'linear',
        dataset_id: GOALS.id,
        links: [],
        order_by: [{ variable_id: VARIABLES[GOALS.id]![0]!.id, direction: 'asc' }],
        outputs: [
          { variable_id: VARIABLES[GOALS.id]![0]!.id, name: 'loja' },
          { variable_id: VARIABLES[GOALS.id]![1]!.id, name: 'meta' },
        ],
      });
    }, SLOW);
  });

  it('a barra de ferramentas tem Cálculo, Tabela de Decisão, Fonte e Agrupar, e Agrupar espera a seleção', async () => {
    open();
    const editor = await region();

    const toolbar = await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW);
    expect(within(toolbar).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cálculo', 'Tabela de Decisão', 'Fonte']);
    const group = within(editor).getByRole('button', { name: 'Agrupar' });
    expect(group).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(await node(/^Produtos, Fonte Linear/));
    expect(within(editor).getByRole('button', { name: 'Agrupar' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Editor, por papel, com a fonte do lote', () => {
  it('o Aprovador roda a prévia e o Calcular por registro, vê os valores no canvas e não edita', async () => {
    simulateCampaign(['workflows.view', 'simulations.run']);
    const { user } = open();
    const editor = await region();

    expect(within(editor).getByText('Só leitura')).toBeInTheDocument();
    expect(tabNames(editor)).toEqual(['Problemas', 'Prévia', 'Calcular']);
    expect(within(editor).queryByRole('toolbar', { name: 'Incluir bloco' })).not.toBeInTheDocument();

    // Prévia: the draft is the saved one (nothing is saved by someone who cannot edit).
    await user.click(within(editor).getByRole('tab', { name: 'Prévia' }));
    await user.click(await within(editor).findByRole('button', { name: 'Rodar prévia' }, SLOW));
    expect(await within(editor).findByText('Contagens sobre os primeiros 500 registros.', undefined, SLOW)).toBeInTheDocument();
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([{ revision: CAMPAIGN.revision, sample_size: 20, parameters: {} }]);
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);

    // Calcular: with the batch source it asks for the record's key, not the values.
    api.respond(
      RUN_ROUTE,
      json({
        status: 'ok',
        record_key: { nf_id: '10', item_seq: '1' },
        inputs: [{ variable: 'valor_item', value: '1500.00', origin: null }],
        nodes: [
          {
            type: 'group',
            node_id: 'grp_pontuacao',
            status: 'ok',
            inputs: { fator: '0.1500', valor_item: '1500.00' },
            outputs: { pontos: '225.00' },
            nodes: [
              { type: 'calculation', node_id: 'calc_pontos', status: 'ok', values: { pontos: '225.00' }, matched_rule: null, warnings: [], error: null },
            ],
          },
        ],
        outputs: { pontos_item: '225.00' },
        input_hash: 'sha256:77b0db21bf50aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        output_hash: 'sha256:11b0db21bf50aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        error: null,
        warnings: [],
      } satisfies Schemas['UnitRunTrace']),
    );
    await user.click(within(editor).getByRole('tab', { name: 'Calcular' }));
    // The workflow panel has a "Chave do registro" of its own (the batch source's); this one is in the bottom panel.
    const bottom = within(await within(editor).findByRole('tabpanel', { name: 'Calcular' }, SLOW));
    const key = await bottom.findByRole('group', { name: 'Chave do registro' }, SLOW);
    expect(bottom.queryByRole('textbox', { name: /valor_item/ })).not.toBeInTheDocument();
    await user.type(within(key).getByRole('textbox', { name: /nf_id/ }), '10');
    await user.type(within(key).getByRole('textbox', { name: /item_seq/ }), '1');
    await user.click(bottom.getByRole('button', { name: 'Calcular' }));

    expect(await screen.findByRole('region', { name: 'Valores do último cálculo' }, SLOW)).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: /^Pontos, Cálculo, ok no último cálculo/ }, SLOW)).toBeInTheDocument();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: CAMPAIGN.revision, record_key: { nf_id: '10', item_seq: '1' }, parameters: {} }]);

    // Read only: the properties of the group, of the batch source and of the Fonte are disabled, never edited.
    fireEvent.click(await node(/^Pontuação, Grupo/));
    expect(await within(editor).findByRole('textbox', { name: /^Nome do grupo/ }, SLOW)).toBeDisabled();
    fireEvent.click(await node('Fonte do lote'));
    expect(await within(editor).findByRole('heading', { name: 'Fonte do lote' }, SLOW)).toBeInTheDocument();
    const checks = await within(editor).findAllByRole('checkbox', undefined, SLOW);
    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) expect(check).toBeDisabled();
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });

  it('o Auditor vê tudo só para leitura, sem Prévia e sem Calcular', async () => {
    simulateCampaign(VIEWER_PERMISSIONS);
    open();
    const editor = await region();

    expect(within(editor).getByText('Só leitura')).toBeInTheDocument();
    expect(tabNames(editor)).toEqual(['Problemas']);
    expect(within(editor).queryByRole('toolbar', { name: 'Incluir bloco' })).not.toBeInTheDocument();

    fireEvent.click(await node('Fonte do lote'));
    expect(await within(editor).findByRole('heading', { name: 'Fonte do lote' }, SLOW)).toBeInTheDocument();
    fireEvent.click(await node(/^Produtos, Fonte Linear/));
    expect(await within(editor).findByRole('textbox', { name: /^Nome do bloco/ }, SLOW)).toBeDisabled();
    fireEvent.click(await node(/^Pontuação, Grupo/));
    expect(await within(editor).findByRole('textbox', { name: /^Nome do grupo/ }, SLOW)).toBeDisabled();
    fireEvent.click(await node(/^Pontos, Cálculo/));
    expect(await within(editor).findByRole('textbox', { name: /^Nome do bloco/ }, SLOW)).toBeDisabled();
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });

  it('o Configurador vê Problemas, Prévia e Calcular, nessa ordem', async () => {
    open();
    const editor = await region();
    expect(tabNames(editor)).toEqual(['Problemas', 'Prévia', 'Calcular']);
  });
});
