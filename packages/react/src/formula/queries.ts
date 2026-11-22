import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../api';

/** The formula language: functions, reserved words and operators, from the same table the engine uses (generated from the contract). */
export type FormulaLanguage = Schemas['FormulaLanguage'];
/** One function of the language (generated from the contract). */
export type FormulaFunction = Schemas['FormulaFunction'];
/** Where the formula is: a Calculation expression, a Decision Table condition or result cell (generated from the contract). */
export type FormulaContext = Schemas['FormulaContext'];
/** A problem of the definition, with its position in code points (generated from the contract). */
export type WorkflowProblem = Schemas['WorkflowProblem'];
/** A variable the definition offers (generated from the contract). */
export type FormulaSymbol = Schemas['Symbol'];
/** A run parameter of the draft, used as `@nome` (generated from the contract). */
export type WorkflowParameter = Schemas['WorkflowParameter'];

/** Cache key (Contracts of the plan, "Chaves de cache"). The language does not change while the module is open. */
export const FORMULA_LANGUAGE_KEY = ['formula-language'] as const;

/** The formula language (`GET /v1/formula-language`). Read once: it only changes with a new version of the API. */
export function useFormulaLanguage() {
  const client = useApiClient();
  return useQuery({
    queryKey: FORMULA_LANGUAGE_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/formula-language', { signal })),
    staleTime: Infinity,
  });
}
