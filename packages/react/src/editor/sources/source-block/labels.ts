// Fixed texts of the Source block (E5-18; design §6, "Bloco Fonte"; estilos §10 and §13).
import type { SelectOption } from '../../../design-system';
import type { Dataset, MultipleRowsPolicy, NoMatchPolicy, SortDirection, SourceMode } from './sourceNode';

export const SOURCE_TITLE = 'Fonte';

export const MODE_LABELS: Readonly<Record<SourceMode, string>> = { linear: 'Linear', filter: 'Filtro' };

/** The Filtro checks whether the row exists: EXISTE (`exists: true`) or NÃO EXISTE (`false`). */
export const EXISTS_LABELS = { exists: 'EXISTE', missing: 'NÃO EXISTE' } as const;

/** "Sem correspondência" (design §6): Gerar erro (default), manter vazio or descartar o registro (`ignorado`). */
export const NO_MATCH_LABELS: Readonly<Record<NoMatchPolicy, string>> = {
  error: 'Gerar erro',
  keep_null: 'Manter vazio',
  discard: 'Descartar o registro',
};

export const MULTIPLE_ROWS_LABELS: Readonly<Record<MultipleRowsPolicy, string>> = {
  error: 'Gerar erro',
  accept_first: 'Aceitar a primeira linha',
};

export const DIRECTION_LABELS: Readonly<Record<SortDirection, string>> = { asc: 'Crescente', desc: 'Decrescente' };

export const DATASET_TYPE_LABELS: Readonly<Record<Dataset['type'], string>> = { table: 'Tabela', sql: 'SQL', excel: 'Excel' };

export const NO_MATCH_POLICIES: readonly NoMatchPolicy[] = ['error', 'keep_null', 'discard'];

export const NO_MATCH_OPTIONS: readonly SelectOption[] = NO_MATCH_POLICIES.map((value) => ({
  value,
  label: NO_MATCH_LABELS[value],
}));

export const MULTIPLE_ROWS_OPTIONS: readonly SelectOption[] = (['error', 'accept_first'] as const).map((value) => ({
  value,
  label: MULTIPLE_ROWS_LABELS[value],
}));

export const DIRECTION_OPTIONS: readonly SelectOption[] = (['asc', 'desc'] as const).map((value) => ({ value, label: DIRECTION_LABELS[value] }));

/** The confirmation of "Aceitar a primeira linha" (E5-18): the acceptance goes to the configuration audit. */
export const ACCEPT_FIRST_TITLE = 'Aceitar a primeira linha';
export const ACCEPT_FIRST_MESSAGE = 'Você assume que vale a primeira linha pela ordenação. Isso fica registrado na auditoria.';

/** A Linear without links (design §6, "Tabela de parâmetros"). */
export const PARAMETER_TABLE_TITLE = 'Tabela de parâmetros';
export const PARAMETER_TABLE_NOTE = 'O dataset precisa ter exatamente uma linha depois dos filtros';

export const NAME_TOOLTIP = 'Letras minúsculas sem acento, números e _, começando por uma letra. Ex.: valor_item';
export const NAME_RULE_MESSAGE = 'Use de 1 a 63 caracteres: letras minúsculas sem acento, números e _, começando por uma letra.';
export const DUPLICATE_VARIABLE_MESSAGE = 'Já existe uma variável com este nome. Escolha outro.';

export const FILTER_NEEDS_LINK = 'Inclua uma ligação antes de usar o modo Filtro: ele confere a linha pelas ligações.';
export const LINEAR_NEEDS_VARIABLES = 'O dataset não tem variáveis. Crie as variáveis no catálogo para usar o modo Linear.';
export const ONE_LINK_IN_FILTER = 'O modo Filtro precisa de pelo menos uma ligação';
export const ONE_ORDER = 'A fonte linear precisa de pelo menos um critério de ordenação';
export const ONE_OUTPUT = 'A fonte linear precisa de pelo menos uma variável de saída';
export const OUTSIDE_DATASET = 'Variável fora do dataset';

/** "1 filtro", "2 filtros". */
export function counted(count: number, one: string, many: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;
}

/** "a, b e c". */
export function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
