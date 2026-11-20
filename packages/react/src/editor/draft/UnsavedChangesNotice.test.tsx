import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftEditorProvider } from './DraftEditor';
import {
  DRAFT,
  DraftProbe,
  SAVE_ROUTE,
  VIEWER_PERMISSIONS,
  WORKFLOW,
  pendingResponse,
  problem,
  renderScreen,
  session,
  simulateApi,
  testQueryClient,
} from './editor.test-support';
import { draftSavesSettled } from './queries';
import { UnsavedChangesNotice } from './UnsavedChangesNotice';
import { draftOwner, findUnsavedChange, keepUnsavedChange } from './unsavedChanges';
import { ApiError } from '../../api';
import { workflowKey } from '../../workflows';

const ANA = draftOwner(session(['workflows.edit']));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('aviso de mudança não salva', () => {
  it('sem permissão de editar, diz por que e não oferece "Voltar ao editor"', async () => {
    simulateApi(VIEWER_PERMISSIONS);
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error: null });
    renderScreen(<UnsavedChangesNotice onReturn={() => {}} />, queryClient);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não deu para salvar a última mudança de Pontuação de exemplo.');
    expect(alert).toHaveTextContent('Você não tem permissão para editar este workflow.');
    expect(screen.queryByRole('button', { name: 'Voltar ao editor' })).not.toBeInTheDocument();
  });

  it('erro que voltaria a acontecer (422): diz o motivo, sem "Voltar ao editor", e some quando a tela sai', async () => {
    simulateApi();
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    const error = new ApiError({ status: 422, code: 'invalid_data', message: 'A definição não é válida.' });
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error });

    function Screens() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown((current) => !current)}>
            Trocar de tela
          </button>
          {shown ? <UnsavedChangesNotice onReturn={() => {}} /> : null}
        </>
      );
    }
    renderScreen(<Screens />, queryClient);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não deu para salvar a última mudança de Pontuação de exemplo.');
    expect(alert).toHaveTextContent('A definição não é válida.');
    expect(screen.queryByRole('button', { name: 'Voltar ao editor' })).not.toBeInTheDocument();
    // The reopened editor does not start from it: saving it again would fail the same way.
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('salvamento ao fechar o editor', () => {
  it('guarda a mudança antes de o salvamento que falhou terminar: quem espera por ele já a encontra', async () => {
    const api = simulateApi();
    const failing = pendingResponse(() => problem(503, 'unavailable'));
    api.respond(SAVE_ROUTE, failing.promise);
    const queryClient = testQueryClient();
    const { unmount } = renderScreen(
      <DraftEditorProvider draft={DRAFT} readOnly={false} owner={ANA}>
        <DraftProbe />
      </DraftEditorProvider>,
      queryClient,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Fórmula de Pontos' }), { target: { value: 'valor_item * 5' } });
    unmount();
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));

    // What the reopened editor does before reading the draft: wait for the saves of the workflow. Right when they
    // settle, the change is already kept.
    let foundWhenSettled: unknown = 'não verificado';
    const settled = draftSavesSettled(queryClient, DRAFT.workflow_id).then(() => {
      foundWhenSettled = findUnsavedChange(queryClient, DRAFT.workflow_id, ANA);
    });
    failing.release();
    await settled;
    expect(foundWhenSettled).toMatchObject({ workflowId: DRAFT.workflow_id, revision: 3, recoverable: true });
  });

  it('sem dono (sessão não carregada), nada é guardado', async () => {
    const api = simulateApi();
    api.respond(SAVE_ROUTE, problem(503, 'unavailable'));
    const queryClient = testQueryClient();
    const { unmount } = renderScreen(
      <DraftEditorProvider draft={DRAFT} readOnly={false}>
        <DraftProbe />
      </DraftEditorProvider>,
      queryClient,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Fórmula de Pontos' }), { target: { value: 'valor_item * 5' } });
    unmount();
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    await draftSavesSettled(queryClient, DRAFT.workflow_id);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, '')).toBeNull();
  });
});
