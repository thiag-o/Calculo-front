// The values of the last "Calcular" drawn on the canvas (E5-21; estilos.md §8, "Debug"): under the name of each block, the
// status (dot + word) and the values in mono-12, the rule of a Decision Table highlighted, the lines a Fonte found and
// the failure; in a group, the status in the header and, collapsed, the value of each Output; and the banner with "Limpar".
import type { ReactNode } from 'react';
import { Button, Status, textClasses } from '../../../design-system';
import type { GroupBoxData } from '../../groups';
import {
  CLEAR_RUN_LABEL,
  NODE_RUN_STATUS,
  NO_RULE_TEXT,
  RECORD_RUN_STATUS,
  RUN_BANNER_LABEL,
  RUN_BANNER_TEXT,
  recordText,
  rowsFoundText,
  ruleText,
  runValuesLabel,
} from './messages';
import type { NodeRunStatus, NodeRunView, RecordRunStatus, RunViews } from './views';
import './run-values.css';

/** The status of a node: dot + word, never only the color. */
export function NodeRunMark({ status }: { status: NodeRunStatus }) {
  const { tone, word } = NODE_RUN_STATUS[status];
  return (
    <Status tone={tone} className="fc-run-status">
      {word}
    </Status>
  );
}

/** What a block shows under its name after a run. */
export function BlockRunValues({ name, run }: { name: string; run: NodeRunView }) {
  return (
    <div className="fc-run" data-run-status={run.status}>
      <div className="fc-run-head">
        <NodeRunMark status={run.status} />
        {run.matchedRule !== undefined ? (
          run.matchedRule === null ? (
            <span className={`fc-run-note ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>{NO_RULE_TEXT}</span>
          ) : (
            <span className={`fc-run-rule ${textClasses({ variant: 'label-12', medium: true })}`}>{ruleText(run.matchedRule)}</span>
          )
        ) : null}
        {run.rowsFound !== undefined ? (
          <span className={`fc-run-note ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>{rowsFoundText(run.rowsFound)}</span>
        ) : null}
      </div>
      {run.values.length > 0 ? (
        <ul className="fc-run-values" aria-label={runValuesLabel(name)}>
          {run.values.map((value) => (
            <li key={value.name} className="fc-run-value">
              <span className={`fc-run-value-name ${textClasses({ variant: 'mono-12', emphasis: 'secondary' })}`}>{value.name}</span>
              <span className={`fc-run-value-text ${textClasses({ variant: 'mono-12' })}`} title={value.text}>
                {value.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {run.error ? <p className={`fc-run-error ${textClasses({ variant: 'label-12' })}`}>{run.error}</p> : null}
    </div>
  );
}

/** The value of an Output of a collapsed group, in place of its type. */
function OutputValue({ text }: { text: string }) {
  return (
    <span className={`fc-run-port-value ${textClasses({ variant: 'mono-12' })}`} title={text}>
      {text}
    </span>
  );
}

type GroupRun = NonNullable<GroupBoxData['run']>;

/** What each group shows after a run (the group node draws it; editor/groups never imports the canvas). */
export function groupRuns(views: RunViews | null): ReadonlyMap<string, GroupRun> {
  const runs = new Map<string, GroupRun>();
  if (!views) return runs;
  for (const [id, view] of views.nodes) {
    if (view.kind !== 'group') continue;
    const outputs = new Map<string, ReactNode>(view.values.map((value) => [value.name, <OutputValue key={value.name} text={value.text} />]));
    runs.set(id, { status: view.status, mark: <NodeRunMark status={view.status} />, outputs });
  }
  return runs;
}

/** The banner over the canvas while it shows the values of the last run: the record's status and "Limpar". */
export function RunBanner({ record, onClear }: { record: RecordRunStatus; onClear: () => void }) {
  const { tone } = RECORD_RUN_STATUS[record];
  return (
    <div className="fc-run-banner" role="region" aria-label={RUN_BANNER_LABEL}>
      <span className={textClasses({ variant: 'label-13' })}>{RUN_BANNER_TEXT}</span>
      <Status tone={tone} className="fc-run-status">
        {recordText(record)}
      </Status>
      <Button variant="secondary" size="small" onClick={onClear}>
        {CLEAR_RUN_LABEL}
      </Button>
    </div>
  );
}
