// Support for the group tests (not a test and not shipped in the package): drafts with a group, with a group inside a
// group and with a Fonte, with the analysis the API would give them (symbols, dependencies and the groups' interfaces).
import type { Schemas } from '../../api';
import type { WorkflowDefinition } from '../draft';

type Node = WorkflowDefinition['root']['nodes'][number];
type Draft = Schemas['Draft'];

export const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

export const DATASET_ID = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02';

export function eligibility(position = { x: 0, y: 0 }): Node {
  return {
    id: 'td_elegibilidade',
    type: 'decision_table',
    name: 'Elegibilidade',
    description: null,
    position,
    hit_policy: 'first',
    rounding_mode: null,
    error_policy: null,
    conditions: [{ expression: 'categoria' }],
    results: [{ name: 'fator', type: 'decimal', scale: 4, default_value: null }],
    rules: [{ when: ['"A"'], then: ['0.15'] }],
  };
}

export function points(position = { x: 240, y: 0 }): Node {
  return {
    id: 'calc_pontos',
    type: 'calculation',
    name: 'Pontos',
    description: null,
    position,
    expression: 'ARRED(valor_item * fator, 2)',
    output: { name: 'pontos', type: 'decimal', scale: 2 },
    rounding_mode: null,
    error_policy: null,
    default_value: null,
  };
}

export function bonus(position = { x: 800, y: 0 }): Node {
  return {
    id: 'calc_bonus',
    type: 'calculation',
    name: 'Bônus',
    description: null,
    position,
    expression: 'pontos * 2',
    output: { name: 'bonus', type: 'decimal', scale: 2 },
    rounding_mode: null,
    error_policy: null,
    default_value: null,
  };
}

/** A Fonte Linear that looks the product up by `categoria` and brings `limite`. */
export function product(position = { x: 0, y: 200 }): Node {
  return {
    id: 'produto',
    type: 'source',
    name: 'Produto',
    description: null,
    position,
    mode: 'linear',
    dataset_id: DATASET_ID,
    links: [{ variable: 'categoria', column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11' }],
    filters: [],
    order_by: [{ variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12', direction: 'desc' }],
    no_match: 'error',
    multiple_rows: 'error',
    exists: null,
    outputs: [{ variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13', name: 'limite' }],
  };
}

export function group(id: string, name: string, nodes: Node[], outputs: string[], position = { x: 0, y: 0 }, collapsed = false): Node {
  return { id, type: 'group', name, description: null, position, collapsed, nodes, outputs };
}

function definition(nodes: Node[]): WorkflowDefinition {
  return {
    schema_version: 2,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
    parameters: [],
    root: {
      batch_source: null,
      inputs: [
        { name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 },
        { name: 'categoria', cardinality: 'linear', type: 'text' },
      ],
      nodes,
      output: { fields: [{ name: 'bonus', variable: 'bonus' }] },
    },
  };
}

function symbols(pointsGroup: string | null): Schemas['Symbol'][] {
  return [
    { name: 'valor_item', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'input', node_id: null, group_id: null },
    { name: 'categoria', type: 'text', scale: null, cardinality: 'linear', list: null, origin: 'input', node_id: null, group_id: null },
    { name: 'fator', type: 'decimal', scale: 4, cardinality: 'linear', list: null, origin: 'decision_table', node_id: 'td_elegibilidade', group_id: pointsGroup },
    { name: 'pontos', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos', group_id: pointsGroup },
    { name: 'bonus', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_bonus', group_id: null },
  ];
}

const BLOCK_DEPENDENCIES: Schemas['Dependency'][] = [
  { node_id: 'td_elegibilidade', reads: ['categoria'] },
  { node_id: 'calc_pontos', reads: ['fator', 'valor_item'] },
  { node_id: 'calc_bonus', reads: ['pontos'] },
];

function draft(changes: Partial<Draft>): Draft {
  return {
    workflow_id: WORKFLOW_ID,
    revision: 4,
    definition: definition([]),
    problems: [],
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: '2026-11-21T10:15:00Z',
    updated_by: BRUNO,
    ...changes,
  };
}

/** The three blocks, nobody grouped yet: Elegibilidade › Pontos › Bônus. */
export function ungroupedDraft(): Draft {
  return draft({
    definition: definition([eligibility(), points(), bonus({ x: 480, y: 0 })]),
    symbols: symbols(null),
    dependencies: BLOCK_DEPENDENCIES,
    order: ['td_elegibilidade', 'calc_pontos', 'calc_bonus'],
  });
}

/** The group "Pontuação" (Elegibilidade and Pontos, giving out `pontos`) and, outside it, Bônus, which reads `pontos`. */
export function groupedDraft(collapsed = false): Draft {
  return draft({
    definition: definition([group('grp_pontuacao', 'Pontuação', [eligibility(), points()], ['pontos'], { x: 0, y: 0 }, collapsed), bonus()]),
    symbols: symbols('grp_pontuacao'),
    dependencies: [{ node_id: 'grp_pontuacao', reads: ['categoria', 'valor_item'] }, ...BLOCK_DEPENDENCIES],
    order: ['grp_pontuacao', 'calc_bonus'],
    groups: [{ node_id: 'grp_pontuacao', inputs: ['categoria', 'valor_item'], outputs: ['pontos'], order: ['td_elegibilidade', 'calc_pontos'] }],
  });
}

/** "Campanha" holds "Pontuação", which holds Elegibilidade and Pontos; both give out `pontos`, read by Bônus outside. */
export function nestedDraft(): Draft {
  const inner = group('grp_pontuacao', 'Pontuação', [eligibility(), points()], ['pontos'], { x: 0, y: 0 });
  return draft({
    definition: definition([group('grp_campanha', 'Campanha', [inner], ['pontos'], { x: 0, y: 0 }), bonus({ x: 1400, y: 0 })]),
    symbols: symbols('grp_pontuacao'),
    dependencies: [
      { node_id: 'grp_campanha', reads: ['categoria', 'valor_item'] },
      { node_id: 'grp_pontuacao', reads: ['categoria', 'valor_item'] },
      ...BLOCK_DEPENDENCIES,
    ],
    order: ['grp_campanha', 'calc_bonus'],
    groups: [
      { node_id: 'grp_campanha', inputs: ['categoria', 'valor_item'], outputs: ['pontos'], order: ['grp_pontuacao'] },
      { node_id: 'grp_pontuacao', inputs: ['categoria', 'valor_item'], outputs: ['pontos'], order: ['td_elegibilidade', 'calc_pontos'] },
    ],
  });
}

/** The ungrouped blocks plus a Fonte Linear (Produto) and an empty group "Bônus" to move blocks into. */
export function withSourceAndEmptyGroup(): Draft {
  const base = ungroupedDraft();
  return {
    ...base,
    definition: definition([...base.definition.root.nodes, product(), group('grp_bonus', 'Grupo de bônus', [], [], { x: 0, y: 400 })]),
    symbols: [
      ...base.symbols,
      { name: 'limite', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'source', node_id: 'produto', group_id: null },
    ],
    dependencies: [...base.dependencies, { node_id: 'produto', reads: ['categoria'] }],
    groups: [{ node_id: 'grp_bonus', inputs: [], outputs: [], order: [] }],
  };
}
