import '@testing-library/jest-dom/vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
// The layout React Flow needs in jsdom (sets up the browser features as a side effect).
import '../canvas/canvas.test-support';
import { Editor } from '..';
import { ANALYSIS_ROUTE, DRAFT_ROUTE, EDITOR_PERMISSIONS, SAVE_ROUTE, json, renderScreen, simulateApi } from '../draft/editor.test-support';
import { DRAFT as CAMPAIGN } from '../preview/preview.test-support';
import { choose } from '../sources/source-block/source-block.test-support';

// The draft the real API served (integration of epic 6): `settings` without `error_limit_percent` and `trace_level` (the
// legacy form, D44). The editor opens it with the defaults of the contract and, on a change, writes both settings.

// The autosave waits 2 s (SAVE_DELAY_MS) after the change.
const SLOW = { timeout: 6000 };

const LEGACY: Schemas['Draft'] = {
  ...CAMPAIGN,
  definition: {
    ...CAMPAIGN.definition,
    // Whatever the generated type says, the real draft lacks the two settings.
    settings: { rounding: { mode: 'half_up', scale: 2 }, error_policy: 'error' } as unknown as Schemas['WorkflowDefinition']['settings'],
  },
};

let saved: Schemas['WorkflowDefinition'][];

beforeEach(() => {
  saved = [];
  const api = simulateApi(EDITOR_PERMISSIONS);
  api.respond(DRAFT_ROUTE, json(LEGACY));
  api.respond(
    ANALYSIS_ROUTE,
    json({ problems: [], symbols: LEGACY.symbols, dependencies: LEGACY.dependencies, order: LEGACY.order, groups: LEGACY.groups }),
  );
  api.respond(SAVE_ROUTE, async (request) => {
    const body = (await request.clone().json()) as { definition: Schemas['WorkflowDefinition'] };
    saved.push(body.definition);
    return json({ ...LEGACY, revision: LEGACY.revision + saved.length, definition: body.definition });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open() {
  return renderScreen(<Editor workflowId={LEGACY.workflow_id} onBack={vi.fn()} />);
}

describe('rascunho com settings na forma legada', () => {
  it('abre o editor e mostra os padrões do contrato no limite de erro e no trace', async () => {
    open();
    expect(await screen.findByRole('textbox', { name: /Limite de erro/ }, SLOW)).toHaveValue('5');
    expect(screen.getByRole('combobox', { name: /Nível do trace/ })).toHaveTextContent('Padrão');
  });

  it('mudar só o limite grava os dois, com o trace no padrão', async () => {
    const { user } = open();
    const limit = await screen.findByRole('textbox', { name: /Limite de erro/ }, SLOW);
    await user.clear(limit);
    await user.type(limit, '2,5');
    await user.tab();

    await waitFor(() => expect(saved.at(-1)?.settings).toMatchObject({ error_limit_percent: '2.5', trace_level: 'standard' }), SLOW);
  });

  it('mudar só o trace grava os dois, com o limite no padrão', async () => {
    const { user } = open();
    await screen.findByRole('textbox', { name: /Limite de erro/ }, SLOW);
    await choose(user, /Nível do trace/, /Completo/);

    await waitFor(() => expect(saved.at(-1)?.settings).toMatchObject({ error_limit_percent: '5', trace_level: 'full' }), SLOW);
  });
});
