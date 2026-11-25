import { useLocation, useNavigate } from 'react-router';
import { NotificationBell } from '../notifications';
import { executionPath, openedFrom, schedulesPath, type ScreenDefinition } from './screens';

/** The bell is for whoever can follow the executions (E7-27): without `executions.view` the module has no Execuções screen. */
export function hasNotificationBell(screens: readonly ScreenDefinition[]): boolean {
  return screens.some((screen) => screen.id === 'executions');
}

/**
 * The bell of the alerts (E7-27), placed by the layout: in the shell, on the right of the content bar; embedded, at the end of
 * the tab row. Its links are the module routes: an alert about an execution opens the panel (`/executions/:id`); one about a
 * schedule opens the Agendamentos tab of the workflow (or the tenant's, without access to Workflows). Renders nothing without
 * `executions.view`.
 */
export function NotificationBellSlot({ screens }: { screens: readonly ScreenDefinition[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!hasNotificationBell(screens)) return null;
  const workflowsAllowed = screens.some((screen) => screen.id === 'workflows');
  return (
    <NotificationBell
      // The panel goes back to the screen the alert was opened from.
      onOpenExecution={(id) => void navigate(executionPath(id), { state: openedFrom(pathname) })}
      onOpenSchedules={(workflowId) => void navigate(schedulesPath(workflowId, workflowsAllowed))}
    />
  );
}
