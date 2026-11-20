import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { workflowKey } from '../../workflows';
import { DRAFT, WORKFLOW, session } from './editor.test-support';
import { ApiError } from '../../api';
import { draftOwner, dropUnsavedChange, findUnsavedChange, isRecoverableSaveError, keepUnsavedChange } from './unsavedChanges';

const ANA = draftOwner(session(['workflows.edit']));
const OTHER = 'outra-pessoa:outro-tenant';

describe('mudança não salva guardada na memória do módulo', () => {
  it('guarda por workflow, com o nome do cache, e só devolve a quem editava', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error: null });

    const kept = findUnsavedChange(queryClient, DRAFT.workflow_id, ANA);
    expect(kept).toMatchObject({ workflowName: 'Pontuação de exemplo', revision: 3 });
    // Another user or tenant on the same module never gets it.
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, OTHER)).toBeNull();
    // Each module (QueryClient) has its own memory.
    expect(findUnsavedChange(new QueryClient(), DRAFT.workflow_id, ANA)).toBeNull();
  });

  it('o editor que retoma a mudança tira só ela: uma mais nova do mesmo workflow fica', () => {
    const queryClient = new QueryClient();
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error: null });
    const older = findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)!;
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 4, error: null });

    dropUnsavedChange(queryClient, older);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)?.revision).toBe(4);
    dropUnsavedChange(queryClient, findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)!);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();
  });

  it('sem dono (sessão não carregada) não guarda nada, e um dono vazio não encontra nada', () => {
    const queryClient = new QueryClient();
    expect(keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: '', definition: DRAFT.definition, revision: 3, error: null })).toBeNull();
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, '')).toBeNull();
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error: null });
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, '')).toBeNull();
  });

  it('só oferece de volta o que pode dar certo ao salvar de novo: rede, erro do servidor e conflito', () => {
    const apiError = (status: number, code: string) => new ApiError({ status, code, message: 'x' });
    expect(isRecoverableSaveError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRecoverableSaveError(apiError(0, 'no_connection'))).toBe(true);
    expect(isRecoverableSaveError(apiError(503, 'unavailable'))).toBe(true);
    expect(isRecoverableSaveError(apiError(409, 'draft_conflict'))).toBe(true);
    expect(isRecoverableSaveError(apiError(422, 'invalid_data'))).toBe(false);
    expect(isRecoverableSaveError(apiError(403, 'no_permission'))).toBe(false);
    expect(isRecoverableSaveError(apiError(404, 'not_found'))).toBe(false);

    const queryClient = new QueryClient();
    keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA, definition: DRAFT.definition, revision: 3, error: apiError(404, 'not_found') });
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();
  });
});
