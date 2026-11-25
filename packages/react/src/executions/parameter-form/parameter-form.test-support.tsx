// Support for the parameters form tests (not a test and not shipped in the package): the browser pieces the select needs, a
// parameter of each kind, the API of the allowed values and a screen that reads the form and shows what it would send.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, vi } from 'vitest';
import { ApiError, ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { ParameterForm } from './ParameterForm';
import { useParameterForm, useScheduleParameterForm } from './useParameterForm';
import type { ParameterFormValues, WorkflowParameter } from './values';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
const prototype = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototype.hasPointerCapture ??= () => false;
prototype.setPointerCapture ??= () => {};
prototype.releasePointerCapture ??= () => {};
prototype.scrollIntoView ??= () => {};

const API = 'https://api.teste';
export const WORKFLOW_ID = '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70';

/** A declared parameter, with the plain defaults (optional, no default, no allowed values). */
export function parameter(name: string, type: Schemas['ParameterType'], extra: Partial<WorkflowParameter> = {}): WorkflowParameter {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...extra };
}

/** An `allowed_values` read from a dataset (E7-5). */
export const QUERY: Schemas['AllowedValuesQuery'] = {
  dataset_id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  variable_id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  filters: [],
};

/** The `fields` of a `422` of the back, as the client turns it into an `ApiError`. */
export function parameterProblem(code: 'missing_parameter' | 'invalid_parameter', fields: Record<string, string>): ApiError {
  return new ApiError({ status: 422, code, message: 'Alguns parâmetros estão inválidos. Confira os valores e tente de novo.', fields });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The values of `GET .../allowed-values`. */
export function allowedValues(values: readonly string[], truncated = false): Response {
  return json({ values, truncated });
}

/** A problem+json of the contract, with the text of the server. */
export function problem(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

type Answer = (search: string | null, name: string) => Response | Promise<Response>;

/**
 * fetch simulated for `GET /v1/workflows/{id}/parameters/{name}/allowed-values`: `answer` gets the `search` (or `null`) and
 * the parameter name. Any other route answers 599. `searches` holds the `search` of every request, in order.
 */
export function simulateAllowedValues(answer: Answer) {
  const searches: (string | null)[] = [];
  const pattern = new RegExp(`^/v1/workflows/${WORKFLOW_ID}/parameters/([^/]+)/allowed-values$`);
  const fetchMock = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const match = pattern.exec(url.pathname);
    if (request.method !== 'GET' || !match) return new Response('rota não simulada', { status: 599 });
    const search = url.searchParams.get('search');
    searches.push(search);
    return answer(search, decodeURIComponent(match[1] ?? ''));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { searches };
}

interface ScreenProps {
  parameters: readonly WorkflowParameter[];
  /** What the back answers when "Enviar" has something to send. */
  answer?: ApiError;
  disabled?: boolean;
  /** `schedule`: the form in the schedule mode, sending `{kind, value}`. */
  mode?: 'run' | 'schedule';
  initial?: ParameterFormValues;
}

/** The form with an "Enviar" button: what would go in `parameters` is shown as JSON in "Enviado". */
function Screen({ parameters, answer, disabled, mode = 'run', initial }: ScreenProps) {
  const run = useParameterForm(parameters, { workflowId: WORKFLOW_ID, initial });
  const schedule = useScheduleParameterForm(parameters, { workflowId: WORKFLOW_ID, initial });
  const form = mode === 'schedule' ? schedule : run;
  const [sent, setSent] = useState('');
  const [failure, setFailure] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const reading = form.read();
        if (!reading.ok) {
          setSent('');
          return;
        }
        setSent(JSON.stringify(reading.parameters));
        if (answer && !form.applyError(answer)) setFailure(answer.message);
      }}
    >
      <ParameterForm {...form.formProps} disabled={disabled} />
      <button type="submit">Enviar</button>
      <output aria-label="Enviado">{sent}</output>
      <output aria-label="Falha">{failure}</output>
    </form>
  );
}

export function renderScreen(props: ScreenProps, options: { advanceTimers?: (ms: number) => unknown } = {}): { user: UserEvent } {
  // No pause between actions (F43); with a fake clock, user-event moves it.
  const user = userEvent.setup({ delay: null, ...(options.advanceTimers ? { advanceTimers: options.advanceTimers } : {}) });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <FluxoRoot>
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Screen {...props} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user };
}
