// Support for the schedule tests (not a test and not shipped in the package): schedules as in the contract example
// (`Schedule`, epic 7), on top of the execution test support (simulated API, providers and the saved draft).
import type { Schemas } from '../../api';
import { OPERATOR_PERMISSIONS, VIEWER_PERMISSIONS, WORKFLOW_ID, json } from '../api/executions.test-support';

export * from '../api/executions.test-support';

/** The Operator with the permission to schedule (E7-14). */
export const SCHEDULER_PERMISSIONS = [...OPERATOR_PERMISSIONS, 'executions.schedule'];
/** Sees the schedules but does not schedule. */
export const SCHEDULE_VIEWER_PERMISSIONS = VIEWER_PERMISSIONS;

export const LIST = 'GET /v1/schedules';
export const CREATE = `POST /v1/workflows/${WORKFLOW_ID}/schedules`;
export const DRAFT = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
export const update = (id: string) => `PUT /v1/schedules/${id}`;
export const remove = (id: string) => `DELETE /v1/schedules/${id}`;

type Schedule = Schemas['Schedule'];

let sequence = 0;
/** A schedule as in the contract example: monthly on day 1 at 02:00, previous month, frozen at 42 with the draft at 42. */
export function schedule(partial: Partial<Schedule> = {}): Schedule {
  sequence += 1;
  return {
    id: `7b8c9d0e-1f2a-4b3c-8d4e-${String(sequence).padStart(12, '0')}`,
    workflow_id: WORKFLOW_ID,
    workflow_name: 'Pontuação de exemplo',
    name: 'Fechamento mensal',
    enabled: true,
    recurrence: { kind: 'monthly', time: '02:00', day: 1 },
    timezone: 'America/Sao_Paulo',
    parameters: { periodo: { kind: 'relative', value: 'previous_month' } },
    draft_revision: 42,
    current_draft_revision: 42,
    next_run_at: '2026-12-01T05:00:00Z',
    last_run: null,
    created_by: { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' },
    created_at: '2026-10-20T13:00:00Z',
    updated_at: '2026-10-20T13:00:00Z',
    ...partial,
  };
}

/** A page of the schedule list. */
export function schedulePage(items: readonly Schedule[], nextCursor: string | null = null): Response {
  return json({ items, next_cursor: nextCursor });
}

/** The body a request sent, as JSON. */
export async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.clone().text());
}
