// The texts of the batch source (estilos.md §10 and §14): what happened and what to do, one label per action.
import { ApiError } from '../../../api';

export const BATCH_SOURCE_TITLE = 'Fonte do lote';

export const DATASETS_ERROR_TITLE = 'Não foi possível listar os datasets';
export const VARIABLES_ERROR_TITLE = 'Não foi possível listar as variáveis do dataset';
export const NO_DATASETS = 'Nenhum dataset no catálogo. Crie um em Catálogo › Datasets.';
export const NO_DATASET_WITH = (search: string) => `Nenhum dataset com “${search}” no nome.`;
export const NO_VARIABLES = 'Este dataset ainda não tem variáveis. Crie as variáveis em Catálogo › Datasets.';
export const NO_OUTPUTS_FOR_KEY = 'Marque as variáveis trazidas para escolher a chave.';
export const NO_OUTPUTS_FOR_ORDER = 'Marque uma variável trazida primeiro';
export const ORDER_KEY_NOTE = 'A chave entra como último critério';
export const NO_ORDER = 'Nenhum critério de ordenação.';
export const NO_FILTERS = 'Nenhum filtro: todas as linhas do dataset viram registros.';
export const UNKNOWN_DATASET = 'Dataset fora do catálogo';
export const LOADING_DATASET = 'Carregando dataset';
export const DATASET_NO_PERMISSION = 'Sem permissão para ver o dataset';
export const DATASET_LOAD_FAILED = 'Não foi possível carregar o dataset';
export const OUT_OF_CATALOG = 'fora do catálogo';
export const DECLARED_INPUTS_NOTE = 'Os valores de cada registro são digitados no Calcular.';
export const BATCH_SOURCE_NOTE = 'Cada linha do dataset é um registro do lote.';
export const CHOOSE_DATASET_NOTE = 'Escolha o dataset dos registros. As entradas declaradas saem quando você escolher.';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';
const NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver o catálogo deste tenant. Peça acesso a um Admin.';
const NOT_FOUND_MESSAGE = 'Este dataset não existe mais no catálogo. Escolha outro.';

/** The message of a catalog read error, by `code` (ADR 0008); otherwise the API's own pt-BR message. */
export function datasetsErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'no_permission') return NO_PERMISSION_MESSAGE;
  if (error.code === 'not_found') return NOT_FOUND_MESSAGE;
  return error.message || UNKNOWN_MESSAGE;
}

export const SORT_DIRECTION_LABELS = { asc: 'Crescente', desc: 'Decrescente' } as const;

/** "1 variável", "5 variáveis". */
export function variablesCount(count: number): string {
  return count === 1 ? '1 variável' : `${count.toLocaleString('pt-BR')} variáveis`;
}

/** "1 entrada declarada", "3 entradas declaradas". */
export function inputsCount(count: number): string {
  return count === 1 ? '1 entrada declarada' : `${count.toLocaleString('pt-BR')} entradas declaradas`;
}
