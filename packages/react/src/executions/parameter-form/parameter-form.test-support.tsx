// Support for the parameters form tests (not a test and not shipped in the package): the browser pieces the select needs, a
// parameter of each kind and a screen that reads the form and shows what it would send.
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach } from 'vitest';
import { ApiError, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { ParameterForm } from './ParameterForm';
import { useParameterForm } from './useParameterForm';
import type { WorkflowParameter } from './values';

afterEach(cleanup);

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

/** A declared parameter, with the plain defaults (optional, no default, no allowed values). */
export function parameter(name: string, type: Schemas['ParameterType'], extra: Partial<WorkflowParameter> = {}): WorkflowParameter {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...extra };
}

/** The `fields` of a `422` of the back, as the client turns it into an `ApiError`. */
export function parameterProblem(code: 'missing_parameter' | 'invalid_parameter', fields: Record<string, string>): ApiError {
  return new ApiError({ status: 422, code, message: 'Alguns parâmetros estão inválidos. Confira os valores e tente de novo.', fields });
}

interface ScreenProps {
  parameters: readonly WorkflowParameter[];
  /** What the back answers when "Enviar" has something to send. */
  answer?: ApiError;
  disabled?: boolean;
}

/** The form with an "Enviar" button: what would go in `parameters` is shown as JSON in "Enviado". */
function Screen({ parameters, answer, disabled }: ScreenProps) {
  const form = useParameterForm(parameters);
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

export function renderScreen(props: ScreenProps): { user: UserEvent } {
  const user = userEvent.setup({ delay: null });
  render(
    <FluxoRoot>
      <Screen {...props} />
    </FluxoRoot>,
  );
  return { user };
}
