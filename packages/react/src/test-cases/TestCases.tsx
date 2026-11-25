import { useId } from 'react';
import { Text } from '../design-system';
import { ReferenceFiles } from './reference-files';
import './test-cases.css';

export interface TestCasesProps {
  /** The workflow whose tests are shown. */
  workflowId: string;
  /**
   * Opens the panel of an execution (`/executions/:id` in the module): the simulation just started by "Simular" and the
   * last comparison of a reference file.
   */
  onOpenExecution: (id: string) => void;
}

/**
 * Testes of a workflow (design §15, E7-25): in epic 7, only the Arquivo de referência section (the inline tests come in
 * epic 10). Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portal of the dialogs and of the menus).
 */
export function TestCases({ workflowId, onOpenExecution }: TestCasesProps) {
  const titleId = useId();
  return (
    <div className="fc-test-cases" role="region" aria-labelledby={titleId}>
      <header className="fc-test-cases-top">
        <Text as="h1" variant="heading-24" id={titleId}>
          Testes
        </Text>
        <Text as="p" variant="label-14" emphasis="secondary">
          Confira o workflow com resultados que você já conhece, antes de executar o lote
        </Text>
      </header>
      {/* Another workflow starts from scratch: no chosen file, open dialog or message of the previous one. */}
      <ReferenceFiles key={workflowId} workflowId={workflowId} onOpenExecution={onOpenExecution} />
    </div>
  );
}
