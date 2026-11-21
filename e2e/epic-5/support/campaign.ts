// The reference campaign (G1, E5-15) of the epic 5 flows: the catalog the simulated API serves (datasets, variables and
// the rows of the three sources) and the workflow "Campanha de referência", as the backend describes it in
// ../backend/docs/campanha-de-referencia.md, with the data of B98 (docker/postgres-sample/reference_campaign.sql,
// docker/sqlserver/reference_campaign.sql and the factors of scripts/reference_campaign.py). Test support only.
import type { Schemas } from '../../support/contract';

type DataType = Schemas['DataType'];
type Definition = Schemas['WorkflowDefinition'];

/** The name of the workflow `prepare-local` creates (backend plan, B100). */
export const CAMPAIGN_WORKFLOW = 'Campanha de referência';

/** A cell of a row, as the source gives it: numbers as text with a point, dates as `YYYY-MM-DD`. */
export type CellValue = string | boolean | null;

export interface CatalogColumn {
  name: string;
  type: DataType;
  scale: number | null;
  sourceType: string;
}

export interface CatalogDataset {
  id: string;
  name: string;
  type: Schemas['Dataset']['type'];
  /** The connection name (null in an Excel dataset), for the origin of the trace. */
  connection: string | null;
  schema: string | null;
  object: string | null;
  sheet: string | null;
  columns: readonly CatalogColumn[];
  rows: readonly Readonly<Record<string, CellValue>>[];
}

const dataset = (index: number) => `c5a00000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`;
const variable = (datasetIndex: number, column: number) =>
  `c5b00000-0000-4000-8000-0000000${String(datasetIndex).padStart(2, '0')}${String(column).padStart(3, '0')}`;

const int = (name: string): CatalogColumn => ({ name, type: 'integer', scale: null, sourceType: 'integer' });
const text = (name: string): CatalogColumn => ({ name, type: 'text', scale: null, sourceType: 'text' });
const money = (name: string): CatalogColumn => ({ name, type: 'decimal', scale: 2, sourceType: 'numeric(12,2)' });
const bool = (name: string): CatalogColumn => ({ name, type: 'boolean', scale: null, sourceType: 'boolean' });
const date = (name: string): CatalogColumn => ({ name, type: 'date', scale: null, sourceType: 'date' });

/** Rows from tuples, in the order of the columns. */
function rows(columns: readonly CatalogColumn[], tuples: readonly (readonly CellValue[])[]): Record<string, CellValue>[] {
  return tuples.map((tuple) => Object.fromEntries(columns.map((column, index) => [column.name, tuple[index] ?? null])));
}

const POSTGRES = 'Postgres da campanha';
const SQL_SERVER = 'SQL Server da campanha';

const ITEMS_COLUMNS = [int('nota_id'), int('item_seq'), text('cod_produto'), int('quantidade'), money('valor_item'), bool('cancelado')];
const INVOICES_COLUMNS = [int('id'), int('numero'), int('loja_id'), int('cliente_id'), date('emissao')];
const STORES_COLUMNS = [int('id'), text('nome'), text('cidade'), text('uf'), bool('participa')];
const CAMPAIGN_PRODUCTS_COLUMNS = [text('cod_produto'), date('incluido_em')];
const PARAMETERS_COLUMNS = [int('id'), money('teto_pontos_item')];
const PRODUCTS_COLUMNS = [int('id'), text('codigo'), text('descricao'), text('categoria'), text('situacao'), date('vigencia_inicio')];
const FACTORS_COLUMNS = [text('categoria'), text('descricao'), money('fator')];

/** `campanha.itens`: 60 items, three per invoice (the batch source). */
export const ITEMS: CatalogDataset = {
  id: dataset(1),
  name: 'Itens de nota fiscal',
  type: 'table',
  connection: POSTGRES,
  schema: 'campanha',
  object: 'itens',
  sheet: null,
  columns: ITEMS_COLUMNS,
  rows: rows(ITEMS_COLUMNS, [
    ['1', '1', 'P01', '10', '389.00', false], ['1', '2', 'P03', '2', '578.00', false], ['1', '3', 'P07', '1', '219.00', false],
    ['2', '1', 'P02', '4', '110.00', false], ['2', '2', 'P10', '1', '19.90', false], ['2', '3', 'P11', '12', '958.80', false],
    ['3', '1', 'P05', '3', '1049.70', false], ['3', '2', 'P05', '1', '349.90', true], ['3', '3', 'P09', '2', '193.60', false],
    ['4', '1', 'P13', '1', '412.00', false], ['4', '2', 'P04', '6', '388.50', false], ['4', '3', 'P08', '2', '84.60', false],
    ['5', '1', 'P06', '1', '89.90', false], ['5', '2', 'P01', '40', '1556.00', false], ['5', '3', 'P14', '2', '49.00', false],
    ['6', '1', 'P03', '5', '1445.00', false], ['6', '2', 'P15', '3', '173.40', false], ['6', '3', 'P10', '10', '199.00', false],
    ['7', '1', 'P01', '8', '311.20', false], ['7', '2', 'P07', '1', '219.00', false], ['7', '3', 'P04', '1', '64.75', false],
    ['8', '1', 'P12', '2', '308.00', false], ['8', '2', 'P09', '12', '1161.60', false], ['8', '3', 'P06', '1', '89.90', false],
    ['9', '1', 'P05', '3', '1049.70', false], ['9', '2', 'P02', '2', '55.00', false], ['9', '3', 'P10', '1', '19.90', false],
    ['10', '1', 'P03', '1', '289.00', false], ['10', '2', 'P08', '15', '634.50', false], ['10', '3', 'P13', '1', '412.00', false],
    ['11', '1', 'P09', '1', '96.80', false], ['11', '2', 'P01', '1', '38.90', false], ['11', '3', 'P07', '5', '1095.00', false],
    ['12', '1', 'P11', '3', '239.70', false], ['12', '2', 'P06', '2', '179.80', false], ['12', '3', 'P02', '10', '275.00', false],
    ['13', '1', 'P05', '1', '349.90', false], ['13', '2', 'P04', '3', '194.25', false], ['13', '3', 'P08', '1', '42.30', false],
    ['14', '1', 'P14', '1', '24.50', false], ['14', '2', 'P03', '4', '1156.00', false], ['14', '3', 'P01', '5', '194.50', false],
    ['15', '1', 'P07', '2', '438.00', false], ['15', '2', 'P12', '1', '154.00', false], ['15', '3', 'P10', '2', '39.80', false],
    ['16', '1', 'P02', '1', '27.50', false], ['16', '2', 'P09', '3', '290.40', false], ['16', '3', 'P15', '1', '57.80', false],
    ['17', '1', 'P06', '12', '1078.80', false], ['17', '2', 'P13', '3', '1236.00', false], ['17', '3', 'P04', '2', '129.50', false],
    ['18', '1', 'P01', '5', '194.50', false], ['18', '2', 'P03', '1', '289.00', false], ['18', '3', 'P08', '1', '42.30', false],
    ['19', '1', 'P05', '1', '349.90', false], ['19', '2', 'P07', '1', '219.00', false], ['19', '3', 'P02', '3', '82.50', false],
    ['20', '1', 'P09', '1', '96.80', false], ['20', '2', 'P06', '1', '89.90', true], ['20', '3', 'P03', '12', '3468.00', false],
  ]),
};

/** `campanha.notas`: 20 invoices; 18 and 19 are of the store out of the campaign. */
export const INVOICES: CatalogDataset = {
  id: dataset(2),
  name: 'Notas fiscais',
  type: 'table',
  connection: POSTGRES,
  schema: 'campanha',
  object: 'notas',
  sheet: null,
  columns: INVOICES_COLUMNS,
  rows: rows(INVOICES_COLUMNS, [
    ['1', '5001', '1', '1', '2026-02-02'], ['2', '5002', '1', '2', '2026-02-03'], ['3', '5003', '1', '3', '2026-02-04'],
    ['4', '5004', '1', '1', '2026-02-05'], ['5', '5005', '1', '4', '2026-02-06'], ['6', '5006', '1', '5', '2026-02-09'],
    ['7', '5007', '2', '6', '2026-02-09'], ['8', '5008', '2', '2', '2026-02-10'], ['9', '5009', '2', '7', '2026-02-11'],
    ['10', '5010', '2', '6', '2026-02-12'], ['11', '5011', '2', '3', '2026-02-13'], ['12', '5012', '3', '8', '2026-02-16'],
    ['13', '5013', '3', '4', '2026-02-17'], ['14', '5014', '3', '5', '2026-02-18'], ['15', '5015', '3', '8', '2026-02-19'],
    ['16', '5016', '3', '7', '2026-02-20'], ['17', '5017', '3', '1', '2026-02-23'], ['18', '5018', '4', '2', '2026-02-24'],
    ['19', '5019', '4', '6', '2026-02-25'], ['20', '5020', '1', '3', '2026-02-26'],
  ]),
};

export const STORES: CatalogDataset = {
  id: dataset(3),
  name: 'Lojas',
  type: 'table',
  connection: POSTGRES,
  schema: 'campanha',
  object: 'lojas',
  sheet: null,
  columns: STORES_COLUMNS,
  rows: rows(STORES_COLUMNS, [
    ['1', 'Loja Centro', 'São Paulo', 'SP', true],
    ['2', 'Loja Norte', 'Recife', 'PE', true],
    ['3', 'Loja Sul', 'Porto Alegre', 'RS', true],
    ['4', 'Loja Outlet', 'Campinas', 'SP', false],
  ]),
};

/** The products of the campaign: P15 is not one of them. */
export const CAMPAIGN_PRODUCTS: CatalogDataset = {
  id: dataset(4),
  name: 'Produtos da campanha',
  type: 'table',
  connection: POSTGRES,
  schema: 'campanha',
  object: 'produtos_campanha',
  sheet: null,
  columns: CAMPAIGN_PRODUCTS_COLUMNS,
  rows: rows(CAMPAIGN_PRODUCTS_COLUMNS, [
    ...['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11'].map((code) => [code, '2026-01-01']),
    ['P12', '2026-01-15'], ['P13', '2026-01-15'], ['P14', '2026-01-15'],
  ]),
};

/** The parameters table: exactly one row. */
export const PARAMETERS: CatalogDataset = {
  id: dataset(5),
  name: 'Parâmetros da campanha',
  type: 'table',
  connection: POSTGRES,
  schema: 'campanha',
  object: 'parametros',
  sheet: null,
  columns: PARAMETERS_COLUMNS,
  rows: rows(PARAMETERS_COLUMNS, [['1', '150.00']]),
};

/** `dbo.produtos` in SQL Server: P12 has two active records, P13 an inactive and an active one, P14 none. */
export const PRODUCTS: CatalogDataset = {
  id: dataset(6),
  name: 'Produtos',
  type: 'table',
  connection: SQL_SERVER,
  schema: 'dbo',
  object: 'produtos',
  sheet: null,
  columns: PRODUCTS_COLUMNS,
  rows: rows(PRODUCTS_COLUMNS, [
    ['1', 'P01', 'Cimento CP-II 50 kg', 'CIM', 'A', '2025-01-01'],
    ['2', 'P02', 'Argamassa AC-III 20 kg', 'CIM', 'A', '2025-01-01'],
    ['3', 'P03', 'Tinta acrílica 18 L', 'TIN', 'A', '2025-01-01'],
    ['4', 'P04', 'Massa corrida 25 kg', 'TIN', 'A', '2025-01-01'],
    ['5', 'P05', 'Furadeira de impacto 650 W', 'FER', 'A', '2025-01-01'],
    ['6', 'P06', 'Jogo de chaves 12 peças', 'FER', 'A', '2025-01-01'],
    ['7', 'P07', 'Cabo flexível 2,5 mm (100 m)', 'ELE', 'A', '2025-01-01'],
    ['8', 'P08', 'Disjuntor bipolar 32 A', 'ELE', 'A', '2025-01-01'],
    ['9', 'P09', 'Tubo PVC 100 mm (6 m)', 'HID', 'A', '2025-01-01'],
    ['10', 'P10', 'Registro de esfera 3/4"', 'HID', 'A', '2025-01-01'],
    ['11', 'P11', 'Piso porcelanato 60x60 (m²)', 'ACA', 'A', '2025-01-01'],
    ['12', 'P12', 'Selador acrílico 18 L', 'CIM', 'A', '2025-03-01'],
    ['13', 'P12', 'Selador acrílico 18 L', 'TIN', 'A', '2026-01-10'],
    ['14', 'P13', 'Escada de alumínio 7 degraus', 'ELE', 'I', '2024-01-01'],
    ['15', 'P13', 'Escada de alumínio 7 degraus', 'FER', 'A', '2025-06-01'],
    ['16', 'P15', 'Pá de bico', 'FER', 'A', '2025-01-01'],
  ]),
};

/** The `Fatores` sheet of `fatores.xlsx`: ACA (Acabamento) has no factor on purpose. */
export const FACTORS: CatalogDataset = {
  id: dataset(7),
  name: 'Fatores por categoria',
  type: 'excel',
  connection: null,
  schema: null,
  object: null,
  sheet: 'Fatores',
  columns: FACTORS_COLUMNS,
  rows: rows(FACTORS_COLUMNS, [
    ['CIM', 'Cimento e argamassa', '0.05'],
    ['TIN', 'Tintas', '0.10'],
    ['FER', 'Ferramentas', '0.08'],
    ['ELE', 'Elétrica', '0.06'],
    ['HID', 'Hidráulica', '0.07'],
  ]),
};

export const CATALOG: readonly CatalogDataset[] = [ITEMS, INVOICES, STORES, CAMPAIGN_PRODUCTS, PARAMETERS, PRODUCTS, FACTORS];

/** The catalog variables of a dataset: one per column, with the column's name. */
export function variablesOf(source: CatalogDataset): Schemas['Variable'][] {
  const index = CATALOG.indexOf(source) + 1;
  return source.columns.map((column, position) => ({
    id: variable(index, position + 1),
    dataset_id: source.id,
    column: column.name,
    name: column.name,
    type: column.type,
    scale: column.scale,
  }));
}

/** The id of the catalog variable `name` of a dataset. */
export function variableId(source: CatalogDataset, name: string): string {
  const found = variablesOf(source).find((each) => each.name === name);
  if (!found) throw new Error(`Variável ${name} não existe em ${source.name}.`);
  return found.id;
}

const out = (source: CatalogDataset, ...names: string[]) => names.map((name) => ({ variable_id: variableId(source, name), name }));
const at = (x: number, y: number) => ({ x, y });

/** The names of the blocks of the campaign workflow (docs/campanha-de-referencia.md, the headings of the rules). */
export const BLOCKS = {
  invoice: 'Nota',
  store: 'Loja',
  inCampaign: 'Produto na campanha',
  product: 'Produto',
  parameters: 'Parâmetros',
  group: 'Pontuação',
  factor: 'Fator da categoria',
  multiplier: 'Multiplicador',
  basePoints: 'Pontos base',
  points: 'Pontos',
} as const;

export const BASE_POINTS_FORMULA = 'ARRED(valor_item * fator, 2)';
export const POINTS_FORMULA = 'MÍN(ARRED(pontos_base * multiplicador, 2), teto_pontos_item)';

/** The rules of "Multiplicador": `valor_item`, `quantidade`, `uf` → `elegivel`, `multiplicador`. */
export const MULTIPLIER_RULES = [
  { when: ['< 20.00', '-', '-'], then: ['falso', '0.00'] },
  { when: ['>= 1000.00', '-', '-'], then: ['verdadeiro', '1.50'] },
  { when: ['-', '>= 10', '-'], then: ['verdadeiro', '1.20'] },
  { when: ['-', '-', '"PE"'], then: ['verdadeiro', '1.10'] },
  { when: ['-', '-', '-'], then: ['verdadeiro', '1.00'] },
] as const;

/** The workflow of the campaign (docs/campanha-de-referencia.md, "As regras"), in the contract's shape (schema 2). */
export const CAMPAIGN_DEFINITION: Definition = {
  schema_version: 2,
  kind: 'batch',
  settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
  root: {
    batch_source: {
      dataset_id: ITEMS.id,
      key: ['nota_id', 'item_seq'],
      filters: [{ variable: 'cancelado', operator: '=', values: ['falso'] }],
      order_by: [
        { variable: 'nota_id', direction: 'asc' },
        { variable: 'item_seq', direction: 'asc' },
      ],
      outputs: out(ITEMS, 'nota_id', 'item_seq', 'cod_produto', 'quantidade', 'valor_item', 'cancelado'),
    },
    inputs: [],
    nodes: [
      {
        id: 'nota',
        type: 'source',
        name: BLOCKS.invoice,
        description: null,
        position: at(0, 0),
        mode: 'linear',
        dataset_id: INVOICES.id,
        links: [{ variable: 'nota_id', column_variable_id: variableId(INVOICES, 'id') }],
        filters: [],
        order_by: [{ variable_id: variableId(INVOICES, 'id'), direction: 'asc' }],
        no_match: 'error',
        multiple_rows: 'error',
        exists: null,
        outputs: out(INVOICES, 'loja_id', 'cliente_id'),
      },
      {
        id: 'loja',
        type: 'source',
        name: BLOCKS.store,
        description: null,
        position: at(0, 160),
        mode: 'linear',
        dataset_id: STORES.id,
        links: [{ variable: 'loja_id', column_variable_id: variableId(STORES, 'id') }],
        filters: [{ variable_id: variableId(STORES, 'participa'), operator: '=', values: ['verdadeiro'] }],
        order_by: [{ variable_id: variableId(STORES, 'id'), direction: 'asc' }],
        no_match: 'discard',
        multiple_rows: 'error',
        exists: null,
        outputs: out(STORES, 'uf'),
      },
      {
        id: 'campanha',
        type: 'source',
        name: BLOCKS.inCampaign,
        description: null,
        position: at(0, 320),
        mode: 'filter',
        dataset_id: CAMPAIGN_PRODUCTS.id,
        links: [{ variable: 'cod_produto', column_variable_id: variableId(CAMPAIGN_PRODUCTS, 'cod_produto') }],
        filters: [],
        exists: true,
      },
      {
        id: 'produto',
        type: 'source',
        name: BLOCKS.product,
        description: null,
        position: at(0, 480),
        mode: 'linear',
        dataset_id: PRODUCTS.id,
        links: [{ variable: 'cod_produto', column_variable_id: variableId(PRODUCTS, 'codigo') }],
        filters: [{ variable_id: variableId(PRODUCTS, 'situacao'), operator: '=', values: ['"A"'] }],
        order_by: [{ variable_id: variableId(PRODUCTS, 'vigencia_inicio'), direction: 'desc' }],
        no_match: 'error',
        multiple_rows: 'accept_first',
        exists: null,
        outputs: out(PRODUCTS, 'categoria'),
      },
      {
        id: 'parametros',
        type: 'source',
        name: BLOCKS.parameters,
        description: null,
        position: at(0, 640),
        mode: 'linear',
        dataset_id: PARAMETERS.id,
        links: [],
        filters: [],
        order_by: [{ variable_id: variableId(PARAMETERS, 'id'), direction: 'asc' }],
        no_match: 'error',
        multiple_rows: 'error',
        exists: null,
        outputs: out(PARAMETERS, 'teto_pontos_item'),
      },
      {
        id: 'grp_pontuacao',
        type: 'group',
        name: BLOCKS.group,
        description: null,
        position: at(320, 0),
        collapsed: false,
        outputs: ['elegivel', 'pontos'],
        nodes: [
          {
            id: 'fator',
            type: 'source',
            name: BLOCKS.factor,
            description: null,
            position: at(24, 24),
            mode: 'linear',
            dataset_id: FACTORS.id,
            links: [{ variable: 'categoria', column_variable_id: variableId(FACTORS, 'categoria') }],
            filters: [],
            order_by: [{ variable_id: variableId(FACTORS, 'categoria'), direction: 'asc' }],
            no_match: 'keep_null',
            multiple_rows: 'error',
            exists: null,
            outputs: out(FACTORS, 'fator'),
          },
          {
            id: 'td_multiplicador',
            type: 'decision_table',
            name: BLOCKS.multiplier,
            description: null,
            position: at(24, 184),
            hit_policy: 'first',
            rounding_mode: null,
            error_policy: null,
            conditions: [{ expression: 'valor_item' }, { expression: 'quantidade' }, { expression: 'uf' }],
            results: [
              { name: 'elegivel', type: 'boolean', default_value: null },
              { name: 'multiplicador', type: 'decimal', scale: 2, default_value: null },
            ],
            rules: MULTIPLIER_RULES.map((rule) => ({ when: [...rule.when], then: [...rule.then] })),
          },
          {
            id: 'calc_pontos_base',
            type: 'calculation',
            name: BLOCKS.basePoints,
            description: null,
            position: at(304, 24),
            expression: BASE_POINTS_FORMULA,
            output: { name: 'pontos_base', type: 'decimal', scale: 2 },
            rounding_mode: null,
            error_policy: 'default_value',
            default_value: '0',
          },
          {
            id: 'calc_pontos',
            type: 'calculation',
            name: BLOCKS.points,
            description: null,
            position: at(304, 184),
            expression: POINTS_FORMULA,
            output: { name: 'pontos', type: 'decimal', scale: 2 },
            rounding_mode: null,
            error_policy: null,
            default_value: null,
          },
        ],
      },
    ],
    output: {
      fields: [
        { name: 'pontos', variable: 'pontos' },
        { name: 'elegivel', variable: 'elegivel' },
      ],
    },
  },
};
