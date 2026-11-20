import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { Fragment, createElement as h, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../../api';
import { clearSessionData, useSession, useSignOut, useSwitchTenant, type Session } from '../../session';
import { workflowKey } from '../../workflows';
import { DraftEditorProvider } from './DraftEditor';
import {
  API,
  DRAFT,
  DRAFT_ROUTE,
  DraftProbe,
  EDITOR_PERMISSIONS,
  SAVE_ROUTE,
  VIEWER_PERMISSIONS,
  WORKFLOW,
  draftWith,
  json,
  pendingResponse,
  problem,
  renderScreen,
  session,
  setCsrfCookie,
  simulateApi,
  testQueryClient,
} from './editor.test-support';
import { draftSavesSettled, fetchDraftAgain } from './queries';
import { UnsavedChangesNotice } from './UnsavedChangesNotice';
import {
  draftOwner,
  dropUnsavedChange,
  findUnsavedChange,
  isRecoverableSaveError,
  keepUnsavedChange,
  subscribeUnsavedChanges,
  useUnsavedDraftChanges,
} from './unsavedChanges';

const ANA = draftOwner(session(['workflows.edit']));
const OTHER = 'outra-pessoa:outro-tenant';
const OTHER_WORKFLOW_ID = '9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a';

const BRANCH_TENANT = { id: '20000000-0000-0000-0000-000000000002', name: 'Filial Sul' };
/** Ana in another tenant, after "Trocar de cliente" (the PUT answer). */
const branchSession: Session = {
  ...session(EDITOR_PERMISSIONS),
  tenants: [session(EDITOR_PERMISSIONS).current_tenant, BRANCH_TENANT],
  current_tenant: BRANCH_TENANT,
};
const ANA_IN_BRANCH = draftOwner(branchSession);

const serverError = new ApiError({ status: 503, code: 'unavailable', message: 'Serviço indisponível.' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A change of Ana on a workflow, as the editor keeps it when the save on close fails. */
function keep(queryClient: QueryClient, workflowId = DRAFT.workflow_id, error: unknown = serverError) {
  return keepUnsavedChange(queryClient, { workflowId, owner: ANA, definition: DRAFT.definition, revision: 3, error });
}

/** The session on screen, with "Sair" and "Trocar de cliente", and how many changes the memory holds for Ana. */
function SessionControls({ children }: { children?: ReactNode }) {
  const queryClient = useQueryClient();
  const current = useSession();
  const signOut = useSignOut();
  const switchTenant = useSwitchTenant();
  const inHeadquarters = useUnsavedDraftChanges(ANA).length;
  const inBranch = useUnsavedDraftChanges(ANA_IN_BRANCH).length;
  return h(
    Fragment,
    null,
    h('output', { 'aria-label': 'Sessão' }, current.data ? current.data.current_tenant.name : 'sem sessão'),
    h('output', { 'aria-label': 'Mudanças guardadas' }, String(inHeadquarters + inBranch)),
    // As the module does after "Sair": the session ends and the data is cleared (ADR 0019).
    h('button', { type: 'button', onClick: () => signOut.mutate(undefined, { onSuccess: () => clearSessionData(queryClient) }) }, 'Sair'),
    h('button', { type: 'button', onClick: () => switchTenant.mutate(BRANCH_TENANT.id) }, 'Trocar de cliente'),
    children,
  );
}

/** Shows or hides its content with a button: leaving a screen and coming back. */
function Toggle({ label, children }: { label: string; children?: ReactNode }) {
  const [shown, setShown] = useState(true);
  return h(Fragment, null, h('button', { type: 'button', onClick: () => setShown((current) => !current) }, label), shown ? children : null);
}

function editor() {
  return h(DraftEditorProvider, { draft: DRAFT, readOnly: false, owner: ANA }, h(DraftProbe));
}

function notice() {
  return h(UnsavedChangesNotice, { onReturn: () => {} });
}

const keptCount = () => screen.getByRole('status', { name: 'Mudanças guardadas' }).textContent;

/** Edits the formula of "Pontos" in the open editor. */
function edit(expression = 'valor_item * 5') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Fórmula de Pontos' }), { target: { value: expression } });
}

/** Waits one turn: the note screen drops what it told only after a turn (StrictMode). */
const nextTurn = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

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

describe('ordem entre guardar e o fim do salvamento', () => {
  it('a mudança é guardada enquanto o salvamento que falhou ainda está em andamento, antes de a promise dele assentar', async () => {
    const api = simulateApi();
    const failing = pendingResponse(() => problem(503, 'unavailable'));
    api.respond(SAVE_ROUTE, failing.promise);
    const queryClient = testQueryClient();
    const { unmount } = renderScreen(editor(), queryClient);
    edit();
    unmount();
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));

    // At the very moment the change enters the memory, asks whether the save is still registered as running: the
    // registration only leaves when its promise settles (`trackDraftSave`). If it is gone, `draftSavesSettled` resolves
    // first; if it is still there, it waits and the other side of the race wins.
    const events: string[] = [];
    let raceAtKeep: Promise<string> | null = null;
    const stop = subscribeUnsavedChanges(queryClient, () => {
      if (raceAtKeep || !findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)) return;
      events.push('guardada');
      raceAtKeep = Promise.race([
        draftSavesSettled(queryClient, DRAFT.workflow_id).then(() => 'já tinha assentado'),
        Promise.resolve().then(() => 'ainda em andamento'),
      ]);
    });
    const settled = draftSavesSettled(queryClient, DRAFT.workflow_id).then(() => events.push('salvamento assentou'));

    failing.release();
    await settled;
    stop();

    expect(events).toEqual(['guardada', 'salvamento assentou']);
    expect(await raceAtKeep).toBe('ainda em andamento');
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toMatchObject({ recoverable: true, revision: 3 });
  });
});

describe('a memória sai com a sessão', () => {
  it('no logout, a memória fica vazia e o salvamento do editor fechado que falha depois não a traz de volta', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    api.respond('DELETE /v1/session', new Response(null, { status: 204 }));
    api.respond(SAVE_ROUTE, problem(401, 'no_session'));
    const queryClient = testQueryClient();
    keep(queryClient, OTHER_WORKFLOW_ID);
    renderScreen(h(SessionControls, null, h(Toggle, { label: 'Fechar o editor' }, editor()), notice()), queryClient);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para salvar a última mudança deste workflow.');
    expect(keptCount()).toBe('1');

    edit();
    // The API ends the session with the sign-out: a screen that asks for it again gets 401.
    api.respond('GET /v1/session', problem(401, 'no_session'));
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await vi.waitFor(() => expect(keptCount()).toBe('0'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(findUnsavedChange(queryClient, OTHER_WORKFLOW_ID, ANA)).toBeNull();

    // The screen of the signed-out person goes away: its save on close gets 401 and keeps nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o editor' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    await draftSavesSettled(queryClient, DRAFT.workflow_id);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();
    expect(keep(queryClient)).toBeNull();
    expect(keptCount()).toBe('0');
  });

  it('na troca de tenant, a memória fica vazia e o salvamento do tenant anterior que falha depois não volta', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    api.respond('PUT /v1/session/tenant', json(branchSession));
    const late = pendingResponse(() => problem(404, 'not_found'));
    api.respond(SAVE_ROUTE, late.promise);
    const queryClient = testQueryClient();
    keep(queryClient, OTHER_WORKFLOW_ID);
    renderScreen(h(SessionControls, null, h(Toggle, { label: 'Fechar o editor' }, editor())), queryClient);
    expect(await screen.findByRole('status', { name: 'Sessão' })).toHaveTextContent('Distribuidora Exemplo');
    expect(keptCount()).toBe('1');

    // The editor closes with a save still on the way, and the tenant switches before it answers.
    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o editor' }));
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de cliente' }));
    await vi.waitFor(() => expect(screen.getByRole('status', { name: 'Sessão' })).toHaveTextContent('Filial Sul'));
    expect(keptCount()).toBe('0');

    late.release();
    await draftSavesSettled(queryClient, DRAFT.workflow_id);
    expect(keptCount()).toBe('0');
    expect(findUnsavedChange(queryClient, OTHER_WORKFLOW_ID, ANA)).toBeNull();
    // In the new tenant, a change of the new owner is kept as usual.
    expect(
      keepUnsavedChange(queryClient, { workflowId: DRAFT.workflow_id, owner: ANA_IN_BRANCH, definition: DRAFT.definition, revision: 3, error: serverError }),
    ).not.toBeNull();
  });

  it('quando a sessão expira (401), clearSessionData esvazia a memória e nada é guardado até chegar uma sessão nova', async () => {
    simulateApi();
    const queryClient = testQueryClient();
    keep(queryClient);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).not.toBeNull();

    act(() => clearSessionData(queryClient));
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();
    // A save of the closed editor that fails now finds no session: it is not kept.
    expect(keep(queryClient)).toBeNull();

    // The session comes back (a new token of the same person): the memory works again.
    renderScreen(h(SessionControls), queryClient);
    expect(await screen.findByRole('status', { name: 'Sessão' })).toHaveTextContent('Distribuidora Exemplo');
    expect(keep(queryClient)).not.toBeNull();
    await vi.waitFor(() => expect(keptCount()).toBe('1'));
  });
});

describe('quem perde a permissão de editar não perde a mudança', () => {
  it('sem workflows.edit, o aviso diz que a mudança fica guardada, sem "Voltar ao editor", e ela só sai no logout', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi(VIEWER_PERMISSIONS);
    api.respond('DELETE /v1/session', new Response(null, { status: 204 }));
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    keep(queryClient);
    renderScreen(h(SessionControls, null, h(Toggle, { label: 'Trocar de tela' }, notice())), queryClient);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não deu para salvar a última mudança de Pontuação de exemplo.');
    expect(alert).toHaveTextContent('Você não tem mais permissão para editar este workflow. A mudança fica guardada até você sair.');
    expect(screen.queryByRole('button', { name: 'Voltar ao editor' })).not.toBeInTheDocument();

    // Leaving the screen does not drop it, unlike a note of an error that would happen again.
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    await nextTurn();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A mudança fica guardada até você sair.');
    expect(keptCount()).toBe('1');

    api.respond('GET /v1/session', problem(401, 'no_session'));
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await vi.waitFor(() => expect(keptCount()).toBe('0'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('o salvamento recusado com 403 no_permission fica guardado, com o mesmo aviso, até a troca de tenant', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    api.respond(SAVE_ROUTE, problem(403, 'no_permission'));
    api.respond('PUT /v1/session/tenant', json(branchSession));
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    renderScreen(
      h(SessionControls, null, h(Toggle, { label: 'Fechar o editor' }, editor()), h(Toggle, { label: 'Trocar de tela' }, notice())),
      queryClient,
    );
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
    expect(await screen.findByRole('status', { name: 'Sessão' })).toHaveTextContent('Distribuidora Exemplo');

    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o editor' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não deu para salvar a última mudança de Pontuação de exemplo.');
    expect(alert).toHaveTextContent('Você não tem mais permissão para editar este workflow. A mudança fica guardada até você sair.');
    expect(screen.queryByRole('button', { name: 'Voltar ao editor' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    await nextTurn();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de tela' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A mudança fica guardada até você sair.');
    expect(keptCount()).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Trocar de cliente' }));
    await vi.waitFor(() => expect(keptCount()).toBe('0'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('salvamento que dá certo', () => {
  it('tira da memória a mudança daquele workflow e daquele dono: o "Não deu para salvar" dele some', async () => {
    const api = simulateApi();
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item * 7' })));
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowKey(WORKFLOW.id), WORKFLOW);
    keep(queryClient);
    keep(queryClient, OTHER_WORKFLOW_ID);
    renderScreen(h(SessionControls, null, notice(), editor()), queryClient);
    await vi.waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(keptCount()).toBe('2');

    // The workflow is saved by another way than "Voltar ao editor" (an editor opened on it).
    edit('valor_item * 7');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(screen.getByRole('status', { name: 'Revisão salva' })).toHaveTextContent('4'));

    expect(keptCount()).toBe('1');
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).toBeNull();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Não deu para salvar a última mudança deste workflow.');
    expect(screen.queryByText('Não deu para salvar a última mudança de Pontuação de exemplo.')).not.toBeInTheDocument();
    // The other workflow was not saved: its change stays.
    expect(findUnsavedChange(queryClient, OTHER_WORKFLOW_ID, ANA)).not.toBeNull();
  });

  it('ler o rascunho de novo não é salvar: a mudança continua guardada', async () => {
    const api = simulateApi();
    const queryClient = testQueryClient();
    renderScreen(h(SessionControls), queryClient);
    expect(await screen.findByRole('status', { name: 'Sessão' })).toHaveTextContent('Distribuidora Exemplo');
    keep(queryClient);

    await fetchDraftAgain(queryClient, createApiClient({ apiUrl: API }), DRAFT.workflow_id);

    expect(api.callCount(DRAFT_ROUTE)).toBe(1);
    expect(findUnsavedChange(queryClient, DRAFT.workflow_id, ANA)).not.toBeNull();
  });
});
