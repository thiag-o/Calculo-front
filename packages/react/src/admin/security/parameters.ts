import { z } from 'zod';
import type { SecuritySettingsUpdate, SecuritySettings, SecurityParameter } from './queries';

/** Name of a parameter, as in the contract (`inatividade_minutos`…). */
export type SecurityField = keyof SecuritySettingsUpdate;

/** What the screen says about each parameter: label, unit (plural and singular) and the group it shows in. */
interface ParameterDescription {
  field: SecurityField;
  label: string;
  unit: string;
  singularUnit: string;
}

export interface ParameterGroup {
  title: string;
  parameters: readonly ParameterDescription[];
}

/** The five parameters, grouped by what they control, in screen order. */
export const GROUPS: readonly ParameterGroup[] = [
  {
    title: 'Sessão',
    parameters: [
      { field: 'inatividade_minutos', label: 'Inatividade da sessão', unit: 'minutos', singularUnit: 'minuto' },
      { field: 'duracao_maxima_dias', label: 'Duração máxima da sessão', unit: 'dias', singularUnit: 'dia' },
    ],
  },
  {
    title: 'Senha',
    parameters: [
      { field: 'senha_minima', label: 'Tamanho mínimo da senha', unit: 'caracteres', singularUnit: 'caractere' },
      { field: 'validade_link_horas', label: 'Validade do link de redefinição', unit: 'horas', singularUnit: 'hora' },
    ],
  },
  {
    title: 'Incorporação',
    parameters: [
      { field: 'validade_token_minutos', label: 'Validade do token de incorporação', unit: 'minutos', singularUnit: 'minuto' },
    ],
  },
];

export const PARAMETERS: readonly ParameterDescription[] = GROUPS.flatMap((group) => group.parameters);
export const FIELDS: readonly SecurityField[] = PARAMETERS.map((parameter) => parameter.field);

/** The form keeps the typed text; it becomes a number only on submit. */
export type FormValues = Record<SecurityField, string>;

/** Number in the Brazilian format (`1.440`). */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** "480 minutos", "1 dia". */
export function quantity(value: number, parameter: ParameterDescription): string {
  return `${formatNumber(value)} ${value === 1 ? parameter.singularUnit : parameter.unit}`;
}

/** Help below the field: the default and the accepted bounds. */
export function parameterHelp(parameter: SecurityParameter): string {
  return `Padrão: ${formatNumber(parameter.padrao)}. Aceita de ${formatNumber(parameter.minimo)} a ${formatNumber(parameter.maximo)}.`;
}

/** The error of an out-of-range value, in the same format as the API. */
export function outOfRangeMessage(parameter: SecurityParameter): string {
  return `Informe um valor de ${formatNumber(parameter.minimo)} a ${formatNumber(parameter.maximo)}.`;
}

export const EMPTY_MESSAGE = 'Informe um valor.';
export const NOT_INTEGER_MESSAGE = 'Informe um número inteiro, sem vírgula nem ponto.';

const INTEGER = /^-?\d+$/;

/** The values in force, as text, for the form. */
export function valuesOf(settings: SecuritySettings): FormValues {
  return Object.fromEntries(FIELDS.map((field) => [field, String(settings[field].valor)])) as FormValues;
}

/** PUT body from already validated values. */
export function bodyOf(values: FormValues): SecuritySettingsUpdate {
  return Object.fromEntries(FIELDS.map((field) => [field, Number(values[field].trim())])) as SecuritySettingsUpdate;
}

/** The fields whose typed value differs from the value in force (compared as numbers when possible). */
export function changedFields(values: FormValues, settings: SecuritySettings): SecurityField[] {
  return FIELDS.filter((field) => {
    const text = values[field].trim();
    return !(INTEGER.test(text) && Number(text) === settings[field].valor);
  });
}

function integerField(parameter: SecurityParameter) {
  return z.string().superRefine((value, context) => {
    const text = value.trim();
    if (text === '') context.addIssue({ code: 'custom', message: EMPTY_MESSAGE });
    else if (!INTEGER.test(text)) context.addIssue({ code: 'custom', message: NOT_INTEGER_MESSAGE });
    else if (Number(text) < parameter.minimo || Number(text) > parameter.maximo) {
      context.addIssue({ code: 'custom', message: outOfRangeMessage(parameter) });
    }
  });
}

/** Client-side validation, with the bounds the API returned (the same ones it checks on PUT). */
export function schemaOf(settings: SecuritySettings) {
  return z.object({
    inatividade_minutos: integerField(settings.inatividade_minutos),
    duracao_maxima_dias: integerField(settings.duracao_maxima_dias),
    senha_minima: integerField(settings.senha_minima),
    validade_link_horas: integerField(settings.validade_link_horas),
    validade_token_minutos: integerField(settings.validade_token_minutos),
  });
}
