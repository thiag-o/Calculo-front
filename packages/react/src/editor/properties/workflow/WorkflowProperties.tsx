import { useRef, useState } from 'react';
import { Button, Dialog, DialogClose, Text } from '../../../design-system';
import { useDraftEditor } from '../../draft';
import { ExecutionSection, ParametersSection } from '../../parameters';
import {
  BATCH_SOURCE_NOTE,
  BatchSourceFields,
  CHOOSE_DATASET_NOTE,
  DECLARED_INPUTS_NOTE,
  DatasetSearch,
  INPUTS_PATH,
  inputsCount,
  isBatchSourceCode,
  variablesCount,
  withBatchSource,
  withoutBatchSource,
  type BatchSourceFieldsProps,
} from '../../sources/batch-source';
import { CommitTextField, ErrorPolicyField, PropertiesFrame, RoundingModeField, SegmentedControl, parseScale } from '../fields';
import { SCALE_RULE_MESSAGE } from '../labels';
import { SETTINGS_PATH, otherProblems, problemsAt } from '../problemPaths';
import './workflow.css';

const ERROR_POLICY_PATH = `${SETTINGS_PATH}.error_policy`;
const SCALE_PATH = `${SETTINGS_PATH}.rounding.scale`;
const MODE_PATH = `${SETTINGS_PATH}.rounding.mode`;
// The run settings, in the Execução section of the "parameters" sub-vertical, which shows their problems itself. Written
// here, not imported: neither side of the cycle with "parameters" uses the other while the module loads (ADR 0052).
const ERROR_LIMIT_PATH = `${SETTINGS_PATH}.error_limit_percent`;
const TRACE_LEVEL_PATH = `${SETTINGS_PATH}.trace_level`;
const PRE_VALIDATION_ALERT_PATH = `${SETTINGS_PATH}.pre_validation_alert_percent`;
const SHOWN = new Set([ERROR_POLICY_PATH, SCALE_PATH, MODE_PATH, ERROR_LIMIT_PATH, TRACE_LEVEL_PATH, PRE_VALIDATION_ALERT_PATH]);

/** Where the values of each record come from (E5-2, E5-17). */
type RecordsOrigin = 'declared' | 'batch';

const ORIGIN_OPTIONS = [
  { value: 'declared', label: 'Entradas declaradas' },
  { value: 'batch', label: 'Fonte do lote' },
] as const satisfies readonly { value: RecordsOrigin; label: string }[];

export type WorkflowPropertiesProps = Pick<BatchSourceFieldsProps, 'renderFilters'>;

/**
 * The workflow settings, shown when nothing is selected: the error policy and the default rounding (places and mode) that
 * the blocks inherit, and where the records come from (E5-17): Entradas declaradas (values typed in "Calcular") or Fonte
 * do lote (each row of a catalog dataset is a record), with the batch source properties right below. Then the run
 * parameters and the run settings (error limit and trace level), from the "parameters" sub-vertical (E6-17).
 *
 * Switching asks for a confirmation that says what is lost. To the batch source, the declared inputs only leave when the
 * dataset is chosen (one change, one undo step); before that, nothing changed in the draft.
 */
export function WorkflowProperties({ renderFilters }: WorkflowPropertiesProps) {
  const { definition, problems, change } = useDraftEditor();
  const { settings } = definition;
  const source = definition.root.batch_source ?? null;
  const inputs = definition.root.inputs;
  /** "Fonte do lote" chosen, the dataset not yet: the search shows, and the draft is still as it was. */
  const [choosing, setChoosing] = useState(false);
  const [confirming, setConfirming] = useState<RecordsOrigin | null>(null);
  const origin: RecordsOrigin = source !== null || choosing ? 'batch' : 'declared';
  const records = useRef<HTMLFieldSetElement>(null);
  const originProblems = problemsAt(problems, INPUTS_PATH).filter((problem) => problem.code === 'inputs_with_batch_source');

  function chooseOrigin(next: RecordsOrigin) {
    if (next === origin) return;
    if (next === 'batch') {
      if (inputs.length > 0) setConfirming('batch');
      else setChoosing(true);
      return;
    }
    // Back to the declared inputs: with a batch source there is something to lose; while choosing, nothing changed yet.
    if (source !== null) setConfirming('declared');
    else setChoosing(false);
  }

  function confirm() {
    const next = confirming;
    setConfirming(null);
    if (next === 'batch') setChoosing(true);
    else if (next === 'declared') {
      setChoosing(false);
      change((current) => withoutBatchSource(current));
    }
  }

  return (
    <PropertiesFrame
      title="Workflow"
      // The batch source problems found by their code show in its own parts (key and order), even without a path.
      problems={otherProblems(problems, SETTINGS_PATH, SHOWN, true).filter((problem) => source === null || !isBatchSourceCode(problem))}
    >
      <ErrorPolicyField
        value={settings.error_policy}
        path={ERROR_POLICY_PATH}
        problems={problemsAt(problems, ERROR_POLICY_PATH)}
        onChange={(policy) => {
          if (policy === null) return;
          change((current) => ({ ...current, settings: { ...current.settings, error_policy: policy } }));
        }}
      />
      <fieldset className="fc-properties-group">
        <legend className="fc-properties-group-title">Arredondamento padrão</legend>
        <CommitTextField
          label="Casas decimais"
          value={String(settings.rounding.scale)}
          inputMode="numeric"
          maxLength={2}
          tooltip="As casas oferecidas a uma saída decimal nova"
          path={SCALE_PATH}
          problems={problemsAt(problems, SCALE_PATH)}
          validate={(text) => (parseScale(text) === null ? SCALE_RULE_MESSAGE : null)}
          onCommit={(text) => {
            const scale = parseScale(text)!;
            change(
              (current) => ({ ...current, settings: { ...current.settings, rounding: { ...current.settings.rounding, scale } } }),
              { mergeKey: SCALE_PATH },
            );
          }}
        />
        <RoundingModeField
          value={settings.rounding.mode}
          path={MODE_PATH}
          problems={problemsAt(problems, MODE_PATH)}
          onChange={(mode) => {
            if (mode === null) return;
            change((current) => ({ ...current, settings: { ...current.settings, rounding: { ...current.settings.rounding, mode } } }));
          }}
        />
      </fieldset>
      <fieldset ref={records} className="fc-properties-group">
        <legend className="fc-properties-group-title">Registros</legend>
        <SegmentedControl
          label="Origem dos valores"
          options={ORIGIN_OPTIONS}
          value={origin}
          path={originProblems.length > 0 ? INPUTS_PATH : null}
          problems={originProblems}
          onChange={chooseOrigin}
        />
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-properties-workflow-note">
          {origin === 'declared' ? DECLARED_INPUTS_NOTE : source === null ? CHOOSE_DATASET_NOTE : BATCH_SOURCE_NOTE}
        </Text>
        {source !== null ? (
          <BatchSourceFields source={source} renderFilters={renderFilters} />
        ) : choosing ? (
          <DatasetSearch
            value={null}
            path={null}
            autoFocus
            onChoose={(dataset) => {
              setChoosing(false);
              change((current) => withBatchSource(current, dataset.id));
            }}
          />
        ) : null}
      </fieldset>
      <ParametersSection />
      <ExecutionSection />
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        // Confirmed to the batch source, the focus goes to the dataset search; otherwise, to the chosen option of the control.
        focusOnClose={() =>
          records.current?.querySelector<HTMLElement>('input[type="search"]') ??
          records.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        }
        title={confirming === 'batch' ? 'Usar a fonte do lote' : 'Usar entradas declaradas'}
        description={
          confirming === 'batch' ? (
            <>
              {capitalized(inputsCount(inputs.length))} {inputs.length === 1 ? 'sai' : 'saem'} do workflow quando você escolher o
              dataset: com a fonte do lote, cada registro vem de uma linha dele. Os blocos que usam essas entradas passam a mostrar um
              problema. Você pode desfazer com Ctrl Z.
            </>
          ) : confirming === 'declared' && source !== null ? (
            <>
              A fonte do lote sai do workflow, com {variablesCount(source.outputs.length)}, a chave, os filtros e a ordenação. Os
              valores passam a ser digitados no Calcular, e os blocos que usam as variáveis dela passam a mostrar um problema. Você
              pode desfazer com Ctrl Z.
            </>
          ) : null
        }
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button variant="danger" onClick={confirm}>
              {confirming === 'batch' ? 'Usar a fonte do lote' : 'Usar entradas declaradas'}
            </Button>
          </>
        }
      />
    </PropertiesFrame>
  );
}

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}
