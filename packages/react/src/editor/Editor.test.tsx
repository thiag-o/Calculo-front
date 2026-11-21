import '@testing-library/jest-dom/vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// The layout React Flow needs in jsdom (sets up the browser features as a side effect).
import './canvas/canvas.test-support';
import { Editor, type EditorProps } from '.';
import {
  ANALYSIS_ROUTE,
  DRAFT,
  DRAFT_ROUTE,
  EDITOR_PERMISSIONS,
  VIEWER_PERMISSIONS,
  json,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './draft/editor.test-support';

// The editor as the module mounts it: layers, canvas, properties, the Decision Table grid and the Problemas and Calcular tabs.

const WORKFLOW_ID = DRAFT.workflow_id;
const SLOW = { timeout: 4000 };

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open(props: Partial<EditorProps> = {}) {
  const onBack = vi.fn();
  const onOpenWorkflows = vi.fn();
  const rendered = renderScreen(<Editor workflowId={WORKFLOW_ID} onBack={onBack} onOpenWorkflows={onOpenWorkflows} {...props} />);
  return { ...rendered, onBack, onOpenWorkflows };
}

const region = () => screen.findByRole('region', { name: 'Editor de Pontuação de exemplo' }, SLOW);
const tabNames = (editor: HTMLElement) => within(editor).getAllByRole('tab').map((tab) => tab.textContent);

describe('Editor, montagem', () => {
  it('monta as camadas, o canvas, as propriedades do workflow e as abas Problemas e Calcular', async () => {
    open();
    const editor = await region();

    expect(within(editor).getByRole('tree', { name: 'Camadas' })).toBeInTheDocument();
    expect(await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW)).toBeInTheDocument();
    expect(within(editor).getByRole('treeitem', { name: /Elegibilidade/ })).toBeInTheDocument();
    // Nothing selected: the workflow settings.
    expect(within(editor).getByText('Política de erro')).toBeInTheDocument();
    expect(tabNames(editor)).toEqual(['Problemas', 'Calcular']);
    expect(within(editor).getByText('Nenhum problema')).toBeInTheDocument();
  });

  it('a seta volta para a Visão geral e o caminho abre a lista', async () => {
    const { user, onBack, onOpenWorkflows } = open();
    const editor = await region();

    await user.click(within(editor).getByRole('button', { name: 'Voltar para a visão geral' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await user.click(within(editor).getByRole('button', { name: 'Workflows' }));
    expect(onOpenWorkflows).toHaveBeenCalledTimes(1);
  });

  it('a aba Calcular abre o formulário das entradas declaradas', async () => {
    const { user } = open();
    const editor = await region();

    await user.click(within(editor).getByRole('tab', { name: 'Calcular' }));
    expect(await within(editor).findByRole('button', { name: 'Calcular' }, SLOW)).toBeEnabled();
    expect(within(editor).getByRole('textbox', { name: /valor_item/ })).toBeInTheDocument();
  });
});

describe('Editor, por permissão', () => {
  it('quem só vê o workflow abre o editor para leitura, sem Calcular', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    open();
    const editor = await region();

    expect(within(editor).getByText('Só leitura')).toBeInTheDocument();
    expect(tabNames(editor)).toEqual(['Problemas']);
    expect(within(editor).queryByRole('toolbar', { name: 'Incluir bloco' })).not.toBeInTheDocument();
  });

  it('quem tem simulations.run vê Calcular e não edita', async () => {
    api = simulateApi(['workflows.view', 'simulations.run']);
    const { user } = open();
    const editor = await region();

    expect(within(editor).getByText('Só leitura')).toBeInTheDocument();
    expect(tabNames(editor)).toEqual(['Problemas', 'Calcular']);
    await user.click(within(editor).getByRole('tab', { name: 'Calcular' }));
    expect(await within(editor).findByRole('button', { name: 'Calcular' }, SLOW)).toBeInTheDocument();
  });

  it('o Configurador vê a barra de ferramentas do canvas', async () => {
    api = simulateApi(EDITOR_PERMISSIONS);
    open();
    const editor = await region();
    expect(await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW)).toBeInTheDocument();
  });
});

describe('Editor, grade da Tabela de Decisão', () => {
  it('Abrir tabela troca o canvas pela grade e Voltar ao canvas devolve o canvas', async () => {
    const { user } = open();
    const editor = await region();

    await user.click(within(editor).getByRole('treeitem', { name: /Elegibilidade/ }));
    await user.click(await within(editor).findByRole('button', { name: 'Abrir tabela' }, SLOW));

    expect(await within(editor).findByRole('region', { name: 'Tabela de Decisão Elegibilidade' }, SLOW)).toBeInTheDocument();
    expect(within(editor).queryByRole('toolbar', { name: 'Incluir bloco' })).not.toBeInTheDocument();

    await user.click(within(editor).getByRole('button', { name: 'Voltar ao canvas' }));
    await waitFor(() => expect(within(editor).queryByRole('region', { name: 'Tabela de Decisão Elegibilidade' })).not.toBeInTheDocument());
    expect(await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW)).toBeInTheDocument();
  });

  it('escolher outro item nas camadas fecha a grade', async () => {
    const { user } = open();
    const editor = await region();

    await user.click(within(editor).getByRole('treeitem', { name: /Elegibilidade/ }));
    await user.click(await within(editor).findByRole('button', { name: 'Abrir tabela' }, SLOW));
    await within(editor).findByRole('region', { name: 'Tabela de Decisão Elegibilidade' }, SLOW);

    await user.click(within(editor).getByRole('treeitem', { name: /Pontos/ }));
    await waitFor(() => expect(within(editor).queryByRole('region', { name: 'Tabela de Decisão Elegibilidade' })).not.toBeInTheDocument());
    expect(await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW)).toBeInTheDocument();
  });

  it('um problema numa célula da tabela, escolhido na aba Problemas, abre a grade', async () => {
    api.respond(
      DRAFT_ROUTE,
      json({
        ...DRAFT,
        problems: [
          {
            code: 'type_mismatch',
            message: 'A condição da regra 1 não é um texto.',
            path: 'root.nodes[0].rules[0].when[0]',
            node_id: 'td_elegibilidade',
            start: 0,
            end: 3,
            suggestion: null,
          },
        ],
      }),
    );
    const { user } = open();
    const editor = await region();

    await user.click(await within(editor).findByRole('button', { name: /A condição da regra 1 não é um texto/ }, SLOW));
    expect(await within(editor).findByRole('region', { name: 'Tabela de Decisão Elegibilidade' }, SLOW)).toBeInTheDocument();
  });

  it('um problema fora da grade (a fórmula de um Cálculo) mantém o canvas', async () => {
    api.respond(
      DRAFT_ROUTE,
      json({
        ...DRAFT,
        problems: [
          {
            code: 'type_mismatch',
            message: 'Esperava um número, mas categoria é um texto.',
            path: 'root.nodes[1].expression',
            node_id: 'calc_pontos',
            start: 6,
            end: 15,
            suggestion: null,
          },
        ],
      }),
    );
    api.respond(ANALYSIS_ROUTE, json({ problems: [], symbols: DRAFT.symbols }));
    const { user } = open();
    const editor = await region();

    await user.click(await within(editor).findByRole('button', { name: /Esperava um número, mas categoria é um texto/ }, SLOW));
    expect(within(editor).queryByRole('region', { name: /^Tabela de Decisão/ })).not.toBeInTheDocument();
    expect(await within(editor).findByRole('toolbar', { name: 'Incluir bloco' }, SLOW)).toBeInTheDocument();
  });
});
