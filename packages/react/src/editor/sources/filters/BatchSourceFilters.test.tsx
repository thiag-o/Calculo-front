import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../../api';
// The layout React Flow needs in jsdom (sets up the browser features as a side effect).
import '../../canvas/canvas.test-support';
import { Editor } from '../..';
import { ANALYSIS_ROUTE, DRAFT_ROUTE, EDITOR_PERMISSIONS, json, renderScreen, simulateApi } from '../../draft/editor.test-support';
import { DRAFT as CAMPAIGN, PREVIEW, PREVIEW_ROUTE } from '../../preview/preview.test-support';
import { GOALS_DATASET, ITEMS_DATASET } from '../batch-source/batch-source.test-support';

// The real draft names the variable of a batch source filter by `variable` (BatchSourceFilter), and a value can be a run
// parameter: the editor opens it, and the filters show as in the Source block (F135). The settings are complete here.

const SLOW = { timeout: 4000 };
const ITEMS_ID = CAMPAIGN.definition.root.batch_source!.dataset_id;
const VARIABLES: Schemas['Variable'][] = ['nota_id', 'item_seq', 'cod_produto', 'valor_item', 'emissao', 'cancelado'].map((name, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  dataset_id: ITEMS_ID,
  column: name,
  name,
  type: name === 'valor_item' ? 'decimal' : name === 'cod_produto' ? 'text' : name === 'emissao' ? 'date' : name === 'cancelado' ? 'boolean' : 'integer',
  scale: name === 'valor_item' ? 2 : null,
}));

const DRAFT: Schemas['Draft'] = {
  ...CAMPAIGN,
  definition: {
    ...CAMPAIGN.definition,
    parameters: [
      {
        name: 'periodo',
        type: 'period',
        required: true,
        list: false,
        scale: null,
        default: { kind: 'relative', value: 'previous_month' },
        allowed_values: null,
        description: 'Mês das notas',
      },
    ],
    root: {
      ...CAMPAIGN.definition.root,
      batch_source: {
        ...CAMPAIGN.definition.root.batch_source!,
        key: ['nota_id', 'item_seq'],
        filters: [
          { variable: 'cancelado', operator: '=', values: ['falso'] },
          { variable: 'emissao', operator: '>=', values: ['@periodo.inicio'] },
          { variable: 'emissao', operator: '<=', values: ['@periodo.fim'] },
        ],
        order_by: [
          { variable: 'nota_id', direction: 'asc' },
          { variable: 'item_seq', direction: 'asc' },
        ],
        outputs: VARIABLES.map((variable) => ({ variable_id: variable.id, name: variable.name })),
      },
    },
  },
};

beforeEach(() => {
  const api = simulateApi(EDITOR_PERMISSIONS);
  api.respond(DRAFT_ROUTE, json(DRAFT));
  api.respond(
    ANALYSIS_ROUTE,
    json({ problems: [], symbols: DRAFT.symbols, dependencies: DRAFT.dependencies, order: DRAFT.order, groups: DRAFT.groups }),
  );
  api.respond('GET /v1/datasets', json({ items: [{ ...ITEMS_DATASET, id: ITEMS_ID, name: 'Itens da nota' }, GOALS_DATASET] }));
  api.respond(`GET /v1/datasets/${ITEMS_ID}/variables`, json({ items: VARIABLES }));
  api.respond(PREVIEW_ROUTE, json(PREVIEW));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('filtros da fonte do lote no editor', () => {
  it('abre o rascunho com os filtros pela variável e os valores com parâmetro', async () => {
    renderScreen(<Editor workflowId={DRAFT.workflow_id} onBack={vi.fn()} />);
    const editor = await screen.findByRole('region', { name: /^Editor de/ }, SLOW);

    fireEvent.click(await screen.findByRole('group', { name: 'Fonte do lote' }, SLOW));
    expect(await within(editor).findByRole('heading', { name: 'Fonte do lote' }, SLOW)).toBeInTheDocument();
    expect(await within(editor).findByRole('textbox', { name: 'Valor (filtro 2)' }, SLOW)).toHaveValue('@periodo.inicio');
    expect(within(editor).getByRole('textbox', { name: 'Valor (filtro 3)' })).toHaveValue('@periodo.fim');
  });
});
