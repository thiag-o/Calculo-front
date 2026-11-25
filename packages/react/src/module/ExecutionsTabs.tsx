import type { ReactNode } from 'react';
import { Tabs, Text } from '../design-system';

/** The two tabs of the tenant Execuções screen (E7-24). */
export type ExecutionsTab = 'executions' | 'schedules';

const TABS = [
  { value: 'executions', label: 'Execuções' },
  { value: 'schedules', label: 'Agendamentos' },
] as const satisfies readonly { value: ExecutionsTab; label: string }[];

export interface ExecutionsTabsProps {
  tab: ExecutionsTab;
  onTabChange: (tab: ExecutionsTab) => void;
  /** The open tab's content: the list of executions (with its own h1) or the schedule list. */
  children: ReactNode;
}

/**
 * The tabs Execuções | Agendamentos of the tenant screen (E7-24, ADR 0027), bound to the route by the module. The Agendamentos tab
 * keeps the screen's h1 for the screen reader only: the list brings its own h2 (the list of executions has the h1 itself).
 */
export function ExecutionsTabs({ tab, onTabChange, children }: ExecutionsTabsProps) {
  return (
    <Tabs<ExecutionsTab>
      label="Abas de Execuções"
      size="small"
      className="fc-module-executions-tabs"
      items={TABS}
      value={tab}
      onValueChange={onTabChange}
    >
      {tab === 'schedules' ? (
        <Text as="h1" variant="heading-24" className="fc-module-hidden">
          Execuções
        </Text>
      ) : null}
      {children}
    </Tabs>
  );
}
