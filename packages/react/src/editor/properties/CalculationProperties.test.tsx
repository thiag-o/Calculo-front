import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormulaEditorProps } from '../../formula';
import { useDraftEditor } from '../draft';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from './properties.test-support';

// The Monaco editor has its own tests (F52); here a plain field shows what the panel gives it.
vi.mock('../../formula', () => ({
  FormulaEditor: ({ value, onChange, problems = [], analyzedValue, readOnly, 'aria-label': label }: FormulaEditorProps) => (
    <div>
      <textarea aria-label={label} value={value} readOnly={readOnly} data-analyzed={analyzedValue ?? ''} onChange={(event) => onChange(event.target.value)} />
      {problems.map((item) => (
        <p key={item.message}>{item.message}</p>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PONTOS = { type: 'node', id: 'calc_pontos' } as const;

/** Moves a block to the top of `root.nodes`, as the canvas could. */
function MoveFirst({ id }: { id: string }) {
  const { change } = useDraftEditor();
  return (
    <button
      type="button"
      onClick={() =>
        change((current) => {
          const node = current.root.nodes.find((candidate) => candidate.id === id)!;
          return { ...current, root: { ...current.root, nodes: [node, ...current.root.nodes.filter((candidate) => candidate !== node)] } };
        })
      }
    >
      Mover para o começo
    </button>
  );
}

function calculation(id = 'calc_pontos') {
  const node = currentDefinition().root.nodes.find((candidate) => candidate.id === id);
  if (node?.type !== 'calculation') throw new Error(`sem o Cálculo ${id}`);
  return node;
}

async function choose(user: UserEvent, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Propriedades do Cálculo', () => {
  it('mostra o nome, a descrição, a fórmula e a saída do bloco selecionado', () => {
    simulateApi();
    renderPanel({ item: PONTOS });

    expect(screen.getByRole('heading', { name: 'Cálculo' })).toBeInTheDocument();
    expect(screen.getByText('calc_pontos')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome do bloco' })).toHaveValue('Pontos');
    expect(screen.getByRole('textbox', { name: 'Descrição curta' })).toHaveValue('Pontos do item na campanha');
    expect(screen.getByRole('textbox', { name: 'Fórmula de Pontos' })).toHaveValue('ARRED(valor_item * fator, 2)');
    expect(screen.getByRole('textbox', { name: 'Nome da variável' })).toHaveValue('pontos');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Decimal');
    expect(screen.getByRole('textbox', { name: 'Casas decimais' })).toHaveValue('2');
    expect(screen.getByRole('combobox', { name: 'Modo de arredondamento' })).toHaveTextContent('Herdar do workflow');
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toHaveTextContent('Herdar do workflow');
  });

  it('cada mudança vai para o rascunho, e a digitação de um campo vira um passo só de desfazer', async () => {
    simulateApi();
    const { user } = renderPanel({ item: PONTOS });

    const name = screen.getByRole('textbox', { name: 'Nome do bloco' });
    await user.clear(name);
    await user.type(name, 'Pontos finais');
    expect(calculation().name).toBe('Pontos finais');

    await user.clear(screen.getByRole('textbox', { name: 'Descrição curta' }));
    expect(calculation().description).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Fórmula de Pontos finais' }), ' + 1');
    expect(calculation().expression).toBe('ARRED(valor_item * fator, 2) + 1');

    const variable = screen.getByRole('textbox', { name: 'Nome da variável' });
    await user.type(variable, '_final');
    expect(calculation().output.name).toBe('pontos_final');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(calculation().output.name).toBe('pontos');
    expect(variable).toHaveValue('pontos');
  });

  it('passa ao editor de fórmula o texto que foi analisado, até a análise nova voltar', async () => {
    simulateApi(() => ({ problems: [], symbols: [], dependencies: [], order: [] }));
    const { user } = renderPanel({ item: PONTOS });

    const formula = screen.getByRole('textbox', { name: 'Fórmula de Pontos' });
    expect(formula).toHaveAttribute('data-analyzed', 'ARRED(valor_item * fator, 2)');

    await user.type(formula, ' * 2');
    expect(formula).toHaveAttribute('data-analyzed', 'ARRED(valor_item * fator, 2)');

    // The analysis runs 400 ms after the last change; then the analysed text is the new one.
    await waitFor(() => expect(formula).toHaveAttribute('data-analyzed', 'ARRED(valor_item * fator, 2) * 2'));
  });

  it('mostra cada problema junto do campo do seu path, e o que não tem campo no topo', () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [
        problem('cycle', 'Ciclo: pontos → pontos.', 'root.nodes[2]', 'calc_pontos'),
        problem('type_mismatch', 'categoria é texto e não entra em conta.', 'root.nodes[2].expression', 'calc_pontos'),
        problem('duplicate_name', 'pontos já é o nome de outra variável.', 'root.nodes[2].output.name', 'calc_pontos'),
        problem('formula_empty', 'Escreva a fórmula de Pontos já ganhos.', 'root.nodes[1].expression', 'calc_historico'),
      ],
    });
    renderPanel({ draft, item: PONTOS });

    expect(screen.getByRole('textbox', { name: 'Nome da variável' })).toHaveAccessibleDescription(
      expect.stringContaining('pontos já é o nome de outra variável.'),
    );
    expect(screen.getByRole('textbox', { name: 'Nome da variável' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'Nome do bloco' })).not.toHaveAttribute('aria-invalid');
    // The formula's problems go to the formula editor, which shows them under the field.
    expect(screen.getByText('categoria é texto e não entra em conta.')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Problemas' })).getByText('Ciclo: pontos → pontos.')).toBeInTheDocument();
    // Another block's problem is not here.
    expect(screen.queryByText('Escreva a fórmula de Pontos já ganhos.')).not.toBeInTheDocument();
  });

  it('acha os problemas pelo lugar do bloco na definição analisada, mesmo depois de a ordem mudar', async () => {
    simulateApi(() => 'pending');
    const draft = exampleDraft({
      problems: [problem('duplicate_name', 'pontos já é o nome de outra variável.', 'root.nodes[2].output.name', 'calc_pontos')],
    });
    const { user } = renderPanel({ draft, item: PONTOS, extra: <MoveFirst id="calc_pontos" /> });

    // The block goes to the top; the analysis of this change has not come back, so the problem still points to nodes[2].
    await user.click(screen.getByRole('button', { name: 'Mover para o começo' }));
    expect(currentDefinition().root.nodes[0]?.id).toBe('calc_pontos');
    expect(screen.getByRole('textbox', { name: 'Nome da variável' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('mostra o valor padrão só com a política "Usar valor padrão", própria ou herdada', async () => {
    simulateApi();
    const { user } = renderPanel({ item: PONTOS });

    expect(screen.queryByRole('textbox', { name: 'Valor padrão' })).not.toBeInTheDocument();

    await choose(user, 'Política de erro', 'Usar valor padrão');
    expect(calculation().error_policy).toBe('default_value');
    await user.type(screen.getByRole('textbox', { name: 'Valor padrão' }), '0');
    expect(calculation().default_value).toBe('0');

    await choose(user, 'Política de erro', 'Deixar vazio com aviso');
    expect(calculation().error_policy).toBe('null_with_warning');
    expect(screen.queryByRole('textbox', { name: 'Valor padrão' })).not.toBeInTheDocument();

    await choose(user, 'Política de erro', 'Herdar do workflow');
    expect(calculation().error_policy).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toHaveAccessibleDescription('O workflow usa: Gerar erro');
    expect(screen.queryByRole('textbox', { name: 'Valor padrão' })).not.toBeInTheDocument();
  });

  it('com o workflow em "Usar valor padrão", o bloco que herda mostra o valor padrão', () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.settings.error_policy = 'default_value';
    renderPanel({ draft, item: PONTOS });
    expect(screen.getByRole('textbox', { name: 'Valor padrão' })).toBeInTheDocument();
  });

  it('o modo de arredondamento herda do workflow ou fica com o do bloco', async () => {
    simulateApi();
    const { user } = renderPanel({ item: PONTOS });

    expect(screen.getByRole('combobox', { name: 'Modo de arredondamento' })).toHaveAccessibleDescription('O workflow usa: Meio para cima');
    await choose(user, 'Modo de arredondamento', 'Cortar');
    expect(calculation().rounding_mode).toBe('down');
    await choose(user, 'Modo de arredondamento', 'Herdar do workflow');
    expect(calculation().rounding_mode).toBeNull();
  });

  it('a saída é inteira ou decimal; a decimal nova recebe as casas do workflow', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.settings.rounding.scale = 4;
    const { user } = renderPanel({ draft, item: PONTOS });

    await user.click(screen.getByRole('combobox', { name: 'Tipo' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Inteiro', 'Decimal']);
    await user.click(screen.getByRole('option', { name: 'Inteiro' }));
    expect(calculation().output).toEqual({ name: 'pontos', type: 'integer' });
    expect(screen.queryByRole('textbox', { name: 'Casas decimais' })).not.toBeInTheDocument();

    await choose(user, 'Tipo', 'Decimal');
    expect(calculation().output).toEqual({ name: 'pontos', type: 'decimal', scale: 4 });

    const scale = screen.getByRole('textbox', { name: 'Casas decimais' });
    await user.clear(scale);
    await user.type(scale, '6');
    expect(calculation().output.scale).toBe(6);
  });

  it('um nome fora da regra ou casas fora do limite ficam só no campo, com o que fazer, e não vão para o rascunho', async () => {
    simulateApi();
    const { user } = renderPanel({ item: PONTOS });

    const variable = screen.getByRole('textbox', { name: 'Nome da variável' });
    await user.clear(variable);
    await user.type(variable, 'Pontos');
    expect(variable).toHaveValue('Pontos');
    expect(variable).toHaveAccessibleDescription(expect.stringContaining('letras minúsculas sem acento'));
    expect(calculation().output.name).toBe('pontos');

    const scale = screen.getByRole('textbox', { name: 'Casas decimais' });
    await user.tripleClick(scale);
    await user.paste('19');
    expect(scale).toHaveValue('19');
    expect(scale).toHaveAccessibleDescription(expect.stringContaining('Use um número inteiro de 0 a 18.'));
    expect(calculation().output.scale).toBe(2);

    const name = screen.getByRole('textbox', { name: 'Nome do bloco' });
    await user.clear(name);
    expect(name).toHaveAccessibleDescription(expect.stringContaining('Informe o nome do bloco.'));
    expect(calculation().name).toBe('Pontos');
  });

  it('o problema clicado na aba Problemas leva o foco ao campo dele', async () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [problem('duplicate_name', 'pontos já é o nome de outra variável.', 'root.nodes[2].output.name', 'calc_pontos')],
    });
    renderPanel({ draft, item: PONTOS, field: 'root.nodes[2].output.name' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nome da variável' })).toHaveFocus());
  });

  it('só leitura: tudo desabilitado, com o motivo', () => {
    simulateApi();
    renderPanel({ item: PONTOS, readOnly: true });

    const reason = 'Você não tem permissão para editar este workflow';
    expect(screen.getByText(reason, { selector: 'p > span' })).toBeVisible();
    for (const name of ['Nome do bloco', 'Descrição curta', 'Nome da variável', 'Casas decimais']) {
      const field = screen.getByRole('textbox', { name });
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
    for (const name of ['Tipo', 'Modo de arredondamento', 'Política de erro']) {
      expect(screen.getByRole('combobox', { name })).toBeDisabled();
    }
    expect(screen.getByRole('textbox', { name: 'Fórmula de Pontos' })).toHaveAttribute('readonly');
  });

  it('uma Tabela de Decisão selecionada mostra as propriedades que o editor der para ela', async () => {
    simulateApi();
    renderPanel({ item: { type: 'node', id: 'td_elegibilidade' }, decisionTable: (node) => <p>Tabela {node.name}</p> });
    await act(async () => {});
    expect(screen.getByText('Tabela Elegibilidade')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cálculo' })).not.toBeInTheDocument();
  });
});
