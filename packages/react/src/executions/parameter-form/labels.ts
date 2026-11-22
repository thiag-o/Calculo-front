import type { Schemas } from '../../api';

type Parameter = Schemas['WorkflowParameter'];

/** The relative defaults by their pt-BR label (plan, E6-17). The execution resolves them from its own "now". */
export const RELATIVE_LABELS: Readonly<Record<Schemas['RelativeDefault'], string>> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  first_day_of_current_month: 'Primeiro dia do mês atual',
  first_day_of_previous_month: 'Primeiro dia do mês anterior',
  last_day_of_previous_month: 'Último dia do mês anterior',
  now: 'Agora',
  current_month: 'Mês atual',
  previous_month: 'Mês anterior',
  last_7_days: 'Últimos 7 dias',
  last_30_days: 'Últimos 30 dias',
};

/** The type in words, under the field ("Número com 2 casas"). */
export function typeDescription(parameter: Pick<Parameter, 'type' | 'scale' | 'list'>): string {
  const base = scalarDescription(parameter.type, parameter.scale);
  return parameter.list ? `Lista de valores: ${base.toLowerCase()}` : base;
}

function scalarDescription(type: Schemas['ParameterType'], scale: number | null): string {
  switch (type) {
    case 'integer':
      return 'Número inteiro';
    case 'decimal':
      return scale === null ? 'Número' : scale === 1 ? 'Número com 1 casa' : `Número com ${scale} casas`;
    case 'date':
      return 'Data';
    case 'datetime':
      return 'Data e hora';
    case 'boolean':
      return 'Verdadeiro ou falso';
    case 'period':
      return 'Período';
    default:
      return 'Texto';
  }
}

/** The help under a field: the type, whether it is required and the description the author wrote. */
export function fieldHelp(parameter: Parameter): string {
  const parts = [typeDescription(parameter)];
  if (parameter.required) parts.push('obrigatório');
  const description = parameter.description?.trim();
  return description ? `${parts.join(', ')}. ${description}` : parts.join(', ');
}
