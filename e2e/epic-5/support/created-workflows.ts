// The workflows a test creates through the API (copies of the "Campanha de referência"), so that the test deletes them at the end:
// in real mode the database keeps whatever a run leaves, and the copies pile up there. The simulation lives in the test's memory
// and needs none of this. Without imports from the other support files, so that screens.ts and fixtures.ts can both use it.
import type { Page } from '@playwright/test';
import { callApi } from '../../epic-2/support/screens';

const created = new WeakMap<Page, { apiOrigin: string; id: string }[]>();

/** Remembers a workflow the test created, to delete it in `deleteCreatedWorkflows`. */
export function trackCreatedWorkflow(page: Page, apiOrigin: string, id: string): void {
  created.set(page, [...(created.get(page) ?? []), { apiOrigin, id }]);
}

/** Deletes (`DELETE /v1/workflows/{id}`, with the page's session) every workflow tracked for the page; returns what failed. */
export async function deleteCreatedWorkflows(page: Page): Promise<string[]> {
  const failures: string[] = [];
  for (const { apiOrigin, id } of created.get(page) ?? []) {
    const result = await callApi(page, apiOrigin, 'DELETE', `/v1/workflows/${id}`).catch((error: unknown) => ({
      status: 0,
      code: String(error),
    }));
    if (result.status !== 204 && result.status !== 200 && result.status !== 404) failures.push(`${id}: ${result.status} ${String(result.code)}`);
  }
  created.delete(page);
  return failures;
}
