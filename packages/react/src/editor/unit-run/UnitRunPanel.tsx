import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, EmptyState, Loading, Notice, Skeleton, Text } from '../../design-system';
import { useDraftEditor } from '../draft';
import { useProblemCounts } from '../problems';
import { CalculatorIcon } from './icons';
import { useRememberedValues } from './memory';
import {
  CONFLICT_MESSAGE,
  CONFLICT_REASON,
  CONFLICT_TITLE,
  UNIT_RUN_LABEL,
  invalidInputs,
  isConflict,
  problemsReason,
  runErrorMessage,
} from './messages';
import { MultipleInputTable } from './MultipleInputTable';
import { useUnitRun, type UnitRunRequest } from './queries';
import { UnitRunResult } from './UnitRunResult';
import { ValueField } from './ValueField';
import { itemFieldPath, readForm, typedItems, typedLinear, type DeclaredInput, type FieldErrors, type TypedItem, type TypedValues } from './values';
import './unit-run.css';

/** The paths of the form, in its order (to focus the first one with an error). */
function formPaths(inputs: readonly DeclaredInput[], values: TypedValues): string[] {
  return inputs.flatMap((input) =>
    input.cardinality === 'multiple'
      ? [input.name, ...typedItems(values, input.name).flatMap((_, index) => input.fields.map((field) => itemFieldPath(input.name, index, field.name)))]
      : [input.name],
  );
}

/** Whether the browser holds the date field of a path half typed (it reports it as empty: `validity.badInput`). */
function isIncomplete(form: HTMLFormElement | null, id: string): boolean {
  const control = form?.ownerDocument.getElementById(id);
  return control instanceof HTMLInputElement && (control.type === 'date' || control.type === 'datetime-local') && control.validity.badInput;
}

/** The same values read the same way: the result shown is of the values on screen. */
function sameInputs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether a path belongs to an input (`pontuacoes`, `pontuacoes[0].taxa`). */
function belongsTo(path: string, input: string): boolean {
  return path === input || path.startsWith(`${input}[`) || path.startsWith(`${input}.`);
}

/**
 * The "Calcular" tab of the bottom panel (E4-14, E4-24): a form generated from the declared inputs and the result of the
 * saved draft for those values. "Calcular" saves what is pending first (`flush`) and is disabled with the reason while the
 * draft has problems. The values typed stay in memory, per workflow, while the module is open. Inside the
 * `DraftEditorProvider` (the editor screen mounts it).
 */
export function UnitRunPanel() {
  const editor = useDraftEditor();
  const { workflowId, definition, readOnly, flush, save, revision, select, reload, reloadState } = editor;
  const counts = useProblemCounts();
  const [values, setValues] = useRememberedValues(workflowId);
  const inputs = definition.root.inputs;

  const prefix = useId();
  const fieldId = useCallback((path: string) => `${prefix}-${path}`, [prefix]);
  const form = useRef<HTMLFormElement>(null);

  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [request, setRequest] = useState<UnitRunRequest | null>(null);
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());
  const [focusPath, setFocusPath] = useState<{ path: string } | null>(null);
  // The date fields the browser holds half typed, by path (checked on leaving the field and on "Calcular").
  const [incomplete, setIncomplete] = useState<ReadonlySet<string>>(() => new Set());
  // What is on screen now, read again after the draft is saved: the edits made while saving are not lost.
  const latest = useRef({ definition, values });
  latest.current = { definition, values };
  const runs = useRef(0);
  // A second submit before the screen shows "running" (a double click) does nothing.
  const busy = useRef(false);

  const run = useUnitRun(workflowId, request);
  const running = saving || run.isFetching;
  const serverErrors = invalidInputs(run.error);
  const conflict = isConflict(run.error) && request !== null && revision === request.revision;
  // A conflict already solved by "Recarregar rascunho" (the revision changed) is no longer shown.
  const showError = run.isError && (conflict || !isConflict(run.error));

  const reading = useMemo(() => readForm(inputs, values, incomplete), [inputs, values, incomplete]);
  const typing: FieldErrors = reading.ok ? {} : reading.errors;
  // The values changed after "Calcular": the result is of the values before.
  const stale = request !== null && (!reading.ok || !sameInputs(reading.inputs, request.inputs));
  const errorAt = useCallback(
    (path: string): string | null => {
      const server = serverErrors?.[path];
      if (server && !edited.has(path)) return server;
      return submitted || touched.has(path) ? (typing[path] ?? null) : null;
    },
    [edited, serverErrors, submitted, touched, typing],
  );
  const checkIncomplete = useCallback(
    (path: string) => {
      const now = isIncomplete(form.current, fieldId(path));
      setIncomplete((current) => {
        if (current.has(path) === now) return current;
        const next = new Set(current);
        if (now) next.add(path);
        else next.delete(path);
        return next;
      });
    },
    [fieldId],
  );
  const markTouched = useCallback(
    (path: string) => {
      setTouched((current) => (current.has(path) ? current : new Set(current).add(path)));
      checkIncomplete(path);
    },
    [checkIncomplete],
  );

  function changeLinear(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setEdited((current) => new Set(current).add(name));
    checkIncomplete(name);
  }

  function changeItems(name: string, items: TypedItem[], path?: string) {
    setValues((current) => ({ ...current, [name]: items }));
    if (path) {
      // Editing a field of an item only takes that field's error away.
      setEdited((current) => new Set(current).add(path));
      checkIncomplete(path);
      return;
    }
    // Including or removing renumbers the items: the API's errors of this list no longer point to the right place, and
    // the half-typed dates are checked again on leaving the field or on "Calcular".
    setEdited((current) => {
      const next = new Set(current);
      for (const key of Object.keys(serverErrors ?? {})) if (belongsTo(key, name)) next.add(key);
      return next;
    });
    setIncomplete((current) => new Set([...current].filter((key) => !belongsTo(key, name))));
  }

  /** Reads the form as it is on screen now, with the half-typed dates found in the page. */
  function readScreen(): ReturnType<typeof readForm> {
    const { definition: current, values: typed } = latest.current;
    const found = new Set(formPaths(current.root.inputs, typed).filter((path) => isIncomplete(form.current, fieldId(path))));
    setIncomplete(found);
    return readForm(current.root.inputs, typed, found);
  }

  /** Shows the errors of a refused form and focuses the first one. */
  function refuse(errors: FieldErrors) {
    setSubmitted(true);
    const { definition: current, values: typed } = latest.current;
    const first = formPaths(current.root.inputs, typed).find((path) => errors[path]);
    if (first) setFocusPath({ path: first });
  }

  // The field (or button) that had the focus before the fieldset was disabled to save gets it back.
  const [focusAfterSave, setFocusAfterSave] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!focusAfterSave) return;
    if (focusAfterSave.ownerDocument.activeElement === focusAfterSave.ownerDocument.body) focusAfterSave.focus();
    setFocusAfterSave(null);
  }, [focusAfterSave]);

  // The first field with an error takes the focus (after "Calcular" with a refused value, or `invalid_inputs`).
  useEffect(() => {
    if (!focusPath) return;
    form.current?.ownerDocument.getElementById(fieldId(focusPath.path))?.focus();
    setFocusPath(null);
  }, [focusPath, fieldId]);

  useEffect(() => {
    if (!serverErrors) return;
    const first = formPaths(inputs, values).find((path) => serverErrors[path]);
    if (first) setFocusPath({ path: first });
    // Only when the answer arrives, not on each keystroke.
  }, [run.error]);

  let disabledReason: string | undefined;
  if (counts.total > 0) disabledReason = problemsReason(counts.total);
  else if (save.status === 'conflict' || conflict) disabledReason = CONFLICT_REASON;

  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (disabledReason || running || busy.current) return;
    const before = readScreen();
    if (!before.ok) {
      refuse(before.errors);
      return;
    }
    setSubmitted(false);
    setSaveFailed(false);
    let saved: number | null = revision;
    // E4-23: the run is of the saved draft, so what is pending is saved first. Read-only has nothing to save. The values
    // are locked while it saves (the fieldset is disabled), and the focus goes back where it was.
    if (!readOnly) {
      const focused = form.current?.ownerDocument.activeElement;
      busy.current = true;
      setSaving(true);
      try {
        saved = await flush();
      } finally {
        busy.current = false;
        setSaving(false);
      }
      if (focused instanceof HTMLElement && focused.isConnected) setFocusAfterSave(focused);
    }
    if (saved === null) {
      setSaveFailed(true);
      return;
    }
    // What is on screen after the save: the definition saved and the values as they are now.
    const after = readScreen();
    if (!after.ok) {
      refuse(after.errors);
      return;
    }
    runs.current += 1;
    setEdited(new Set());
    setRequest({ id: runs.current, revision: saved, inputs: after.inputs, definition: latest.current.definition });
  }

  return (
    <form ref={form} className="fc-unit-run" aria-label={UNIT_RUN_LABEL} noValidate onSubmit={(event) => void calculate(event)}>
      <div className="fc-unit-run-form">
        <div className="fc-unit-run-head">
          <h3 className="fc-unit-run-title">Valores</h3>
          <Button type="submit" variant="primary" size="small" loading={running} disabledReason={disabledReason} showReason="beside">
            {UNIT_RUN_LABEL}
          </Button>
        </div>
        {inputs.length === 0 ? (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
            Nenhuma entrada declarada. O cálculo usa só as fórmulas.
          </Text>
        ) : (
          <fieldset className="fc-unit-run-inputs" disabled={saving}>
            <legend className="fc-visually-hidden">Valores das entradas</legend>
            {inputs.map((input) =>
              input.cardinality === 'multiple' ? (
                <MultipleInputTable
                  key={input.name}
                  input={input}
                  items={typedItems(values, input.name)}
                  onChange={(items, path) => changeItems(input.name, items, path)}
                  fieldId={fieldId}
                  errorAt={errorAt}
                  onBlurField={markTouched}
                />
              ) : (
                <ValueField
                  key={input.name}
                  id={fieldId(input.name)}
                  label={input.name}
                  type={input.type}
                  scale={input.scale}
                  value={typedLinear(values, input.name)}
                  error={errorAt(input.name)}
                  onBlur={() => markTouched(input.name)}
                  onChange={(value) => changeLinear(input.name, value)}
                />
              ),
            )}
          </fieldset>
        )}
      </div>

      <div className="fc-unit-run-output">
        {/* Gone once the draft is saved again ("Tentar de novo" or "Recarregar rascunho" at the top of the editor). */}
        {saveFailed && !running && save.status !== 'saved' ? (
          <Notice type="error" title="O rascunho não foi salvo">
            Calcular roda o rascunho salvo. Resolva o aviso no topo do editor e calcule de novo.
          </Notice>
        ) : running ? (
          <Loading label="Calculando" className="fc-unit-run-loading">
            <Skeleton width={120} />
            <Skeleton width="60%" />
            <Skeleton width="80%" />
          </Loading>
        ) : request === null || (run.isError && !showError) ? (
          <EmptyState
            className="fc-unit-run-empty"
            icon={<CalculatorIcon />}
            title="Nenhum cálculo ainda"
            description="Preencha os valores e clique em Calcular para ver as saídas e cada bloco."
          />
        ) : showError ? (
          <RunError
            error={run.error}
            unmatched={serverErrors ? Object.keys(serverErrors).filter((path) => !formPaths(inputs, values).includes(path)) : []}
            reloading={reloadState.reloading}
            reloadError={reloadState.error !== null}
            onReload={() => void reload()}
          />
        ) : run.data ? (
          <>
            {stale ? (
              <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-stale">
                Resultado de valores anteriores. Calcule de novo para ver o dos valores atuais.
              </Text>
            ) : null}
            <UnitRunResult run={run.data} definition={request.definition} currentDefinition={definition} onSelectNode={(id) => select({ type: 'node', id })} />
          </>
        ) : null}
        <span className="fc-visually-hidden" role="status">
          {run.data && !running ? `Resultado do cálculo: ${run.data.status === 'ok' ? 'ok' : run.data.status === 'ok_with_warnings' ? 'com avisos' : 'erro'}` : ''}
        </span>
      </div>
    </form>
  );
}

interface RunErrorProps {
  error: unknown;
  /** `invalid_inputs` paths with no field on screen (the inputs changed meanwhile). */
  unmatched: readonly string[];
  reloading: boolean;
  reloadError: boolean;
  onReload: () => void;
}

function RunError({ error, unmatched, reloading, reloadError, onReload }: RunErrorProps) {
  if (isConflict(error)) {
    return (
      <Notice
        type="warning"
        title={CONFLICT_TITLE}
        actions={
          <Button size="small" loading={reloading} onClick={onReload}>
            Recarregar rascunho
          </Button>
        }
      >
        {reloadError ? 'Não foi possível recarregar o rascunho. Tente de novo em instantes.' : CONFLICT_MESSAGE}
      </Notice>
    );
  }
  const fields = invalidInputs(error);
  if (fields) {
    return (
      <Notice type="error" title="Alguns valores foram recusados">
        Confira os campos marcados e calcule de novo.
        {unmatched.length > 0 ? (
          <ul className="fc-unit-run-unmatched">
            {unmatched.map((path) => (
              <li key={path}>
                <span className="fc-unit-run-code">{path}</span> {fields[path]}
              </li>
            ))}
          </ul>
        ) : null}
      </Notice>
    );
  }
  const { title, message } = runErrorMessage(error);
  return (
    <Notice type="error" title={title}>
      {message}
    </Notice>
  );
}
