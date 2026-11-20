import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi, whenFocused } from './properties.test-support';

vi.mock('../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const INPUTS = { type: 'inputs' } as const;

function inputItem(name: string) {
  return screen.getByRole('group', { name: `Entrada ${name}` });
}

async function choose(user: UserEvent, scope: HTMLElement, label: string, option: string) {
  await user.click(within(scope).getByRole('combobox', { name: new RegExp(`^${label}( \(.+\))?$`) }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Propriedades das entradas', () => {
  it('lista as entradas com nome, Linear ou Múltiplo, tipo e casas; a múltipla mostra os campos', () => {
    simulateApi();
    renderPanel({ item: INPUTS });

    expect(screen.getByRole('heading', { name: 'Entradas' })).toBeInTheDocument();
    const valor = inputItem('valor_item');
    expect(within(valor).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toHaveValue('valor_item');
    expect(within(valor).getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(within(valor).getByRole('combobox', { name: /^Tipo( \(.+\))?$/ })).toHaveTextContent('Decimal');
    expect(within(valor).getByRole('textbox', { name: /^Casas decimais( \(.+\))?$/ })).toHaveValue('2');

    const categoria = inputItem('categoria');
    expect(within(categoria).getByRole('combobox', { name: /^Tipo( \(.+\))?$/ })).toHaveTextContent('Texto');
    expect(within(categoria).queryByRole('textbox', { name: /^Casas decimais( \(.+\))?$/ })).not.toBeInTheDocument();

    const pontuacoes = inputItem('pontuacoes');
    expect(within(pontuacoes).getByRole('radio', { name: 'Múltiplo' })).toBeChecked();
    const taxa = within(pontuacoes).getByRole('group', { name: 'Campo taxa' });
    expect(within(taxa).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ })).toHaveValue('taxa');
    expect(within(taxa).getByRole('textbox', { name: /^Casas decimais( \(.+\))?$/ })).toHaveValue('4');
  });

  it('cada mudança vai para o rascunho: nome, tipo e casas', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const categoria = inputItem('categoria');
    await user.type(within(categoria).getByRole('textbox', { name: /^Nome( \(.+\))?$/ }), '_item');
    expect(currentDefinition().root.inputs[1]).toEqual({ name: 'categoria_item', cardinality: 'linear', type: 'text' });

    await choose(user, inputItem('categoria_item'), 'Tipo', 'Decimal');
    expect(currentDefinition().root.inputs[1]).toEqual({ name: 'categoria_item', cardinality: 'linear', type: 'decimal', scale: 2 });

    const scale = within(inputItem('categoria_item')).getByRole('textbox', { name: /^Casas decimais( \(.+\))?$/ });
    await user.tripleClick(scale);
    await user.paste('3');
    expect(currentDefinition().root.inputs[1]).toMatchObject({ scale: 3 });

    await choose(user, inputItem('categoria_item'), 'Tipo', 'Inteiro');
    expect(currentDefinition().root.inputs[1]).toEqual({ name: 'categoria_item', cardinality: 'linear', type: 'integer' });
  });

  it('Linear ou Múltiplo pelo teclado: Tab entra na opção escolhida e as setas trocam', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const valor = inputItem('valor_item');
    within(valor).getByRole('textbox', { name: /^Nome( \(.+\))?$/ }).focus();
    await user.tab();
    const linear = within(valor).getByRole('radio', { name: 'Linear' });
    expect(linear).toHaveFocus();
    expect(within(valor).getByRole('radio', { name: 'Múltiplo' })).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    const multiple = within(inputItem('valor_item')).getByRole('radio', { name: 'Múltiplo' });
    expect(multiple).toBeChecked();
    expect(multiple).toHaveFocus();
    // The Múltiplo needs a field: the linear one becomes its first field, with a free name.
    expect(currentDefinition().root.inputs[0]).toEqual({
      name: 'valor_item',
      cardinality: 'multiple',
      fields: [{ name: 'campo_1', type: 'decimal', scale: 2 }],
    });

    await user.keyboard('{ArrowLeft}');
    expect(within(inputItem('valor_item')).getByRole('radio', { name: 'Linear' })).toHaveFocus();
    expect(currentDefinition().root.inputs[0]).toEqual({ name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 });

    await user.keyboard('{End}');
    expect(currentDefinition().root.inputs[0]?.cardinality).toBe('multiple');
    await user.keyboard('{Home}');
    expect(currentDefinition().root.inputs[0]?.cardinality).toBe('linear');
  });

  it('inclui uma entrada nova no fim, com nome livre, e põe o foco no nome dela', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    await user.click(screen.getByRole('button', { name: 'Incluir entrada' }));
    expect(currentDefinition().root.inputs[3]).toEqual({ name: 'entrada_1', cardinality: 'linear', type: 'decimal', scale: 2 });
    await waitFor(() => expect(within(inputItem('entrada_1')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toHaveFocus());
  });

  it('inclui e remove campos da múltipla; o último campo não sai', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const pontuacoes = inputItem('pontuacoes');
    await user.click(within(pontuacoes).getByRole('button', { name: /^Incluir campo( \(.+\))?$/ }));
    const fields = () => {
      const input = currentDefinition().root.inputs[2];
      return input?.cardinality === 'multiple' ? input.fields : [];
    };
    expect(fields().map((field) => field.name)).toEqual(['valor_compra', 'taxa', 'campo_1']);

    const novo = within(pontuacoes).getByRole('group', { name: 'Campo campo_1' });
    await user.type(within(novo).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ }), '0');
    expect(fields()[2]?.name).toBe('campo_10');

    for (const name of ['campo_10', 'taxa']) {
      await user.click(within(within(pontuacoes).getByRole('group', { name: `Campo ${name}` })).getByRole('button', { name: /^Remover campo( \(.+\))?$/ }));
    }
    expect(fields().map((field) => field.name)).toEqual(['valor_compra']);

    const last = within(within(pontuacoes).getByRole('group', { name: 'Campo valor_compra' })).getByRole('button', { name: /^Remover campo( \(.+\))?$/ });
    expect(last).toHaveAttribute('aria-disabled', 'true');
    expect(last).toHaveAccessibleDescription('A entrada múltipla precisa de pelo menos um campo');
    await user.click(last);
    expect(fields()).toHaveLength(1);
  });

  it('remove uma entrada só depois de confirmar', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover entrada' });
    expect(dialog).toHaveTextContent('categoria');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item', 'categoria', 'pontuacoes']);

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Remover entrada' })).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item', 'pontuacoes']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o aviso de remover diz quantos blocos usam a entrada, pelas dependências da análise', async () => {
    simulateApi();
    const draft = exampleDraft({
      dependencies: [
        { node_id: 'td_elegibilidade', reads: ['categoria'] },
        // Only the dependencies count: calc_historico reads a field of pontuacoes; calc_pontos has valor_item in its
        // formula but not in its reads; a node no longer in the definition does not count.
        { node_id: 'calc_historico', reads: ['taxa'] },
        { node_id: 'calc_pontos', reads: ['categoria', 'fator'] },
        { node_id: 'no_longer_there', reads: ['categoria', 'valor_item'] },
      ],
    });
    const { user } = renderPanel({ draft, item: INPUTS });

    async function warning(name: string) {
      await user.click(within(inputItem(name)).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Remover entrada' });
      const text = dialog.textContent;
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      return text;
    }

    expect(await warning('categoria')).toContain('2 blocos usam esta entrada e passam a mostrar um problema. Você pode desfazer');
    expect(await warning('pontuacoes')).toContain('1 bloco usa esta entrada e passa a mostrar um problema.');
    expect(await warning('valor_item')).toContain('Nenhum bloco usa esta entrada.');
  });

  it('reordena as entradas; nas pontas, o botão diz por que não move', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const first = within(inputItem('valor_item')).getByRole('button', { name: /^Mover para cima( \(.+\))?$/ });
    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(first).toHaveAccessibleDescription('Já é a primeira entrada');
    expect(within(inputItem('pontuacoes')).getByRole('button', { name: /^Mover para baixo( \(.+\))?$/ })).toHaveAccessibleDescription('Já é a última entrada');

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Mover para cima( \(.+\))?$/ }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['categoria', 'valor_item', 'pontuacoes']);
    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Mover para baixo( \(.+\))?$/ }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item', 'categoria', 'pontuacoes']);
    expect(within(screen.getByRole('list', { name: 'Entradas declaradas' })).getAllByRole('textbox', { name: /^Nome( \(.+\))?$/ }).map((field) => (field as HTMLInputElement).value)).toEqual([
      'valor_item',
      'categoria',
      'pontuacoes',
    ]);
  });

  it('mostra cada problema junto do campo do seu path', () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [
        problem('reserved_name', 'em é uma palavra reservada e não pode ser nome de variável.', 'root.inputs[1].name'),
        problem('duplicate_name', 'taxa já é o nome de outra variável.', 'root.inputs[2].fields[1].name'),
      ],
    });
    renderPanel({ draft, item: INPUTS });

    expect(within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toHaveAccessibleDescription(
      expect.stringContaining('em é uma palavra reservada'),
    );
    expect(within(inputItem('valor_item')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).not.toHaveAttribute('aria-invalid');
    const taxa = within(inputItem('pontuacoes')).getByRole('group', { name: 'Campo taxa' });
    expect(within(taxa).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ })).toHaveAccessibleDescription(
      expect.stringContaining('taxa já é o nome de outra variável.'),
    );
  });

  it('o problema da cardinalidade aparece junto do Linear ou Múltiplo', () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [problem('multiple_in_output', 'A entrada categoria não pode ser múltipla aqui.', 'root.inputs[1].cardinality')],
    });
    renderPanel({ draft, item: INPUTS });

    const group = within(inputItem('categoria')).getByRole('radiogroup', { name: /^Cardinalidade( \(.+\))?$/ });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('A entrada categoria não pode ser múltipla aqui.');
    expect(within(inputItem('valor_item')).getByRole('radiogroup', { name: /^Cardinalidade( \(.+\))?$/ })).not.toHaveAttribute('aria-invalid');
    // Shown beside the control, so not again in the list at the top.
    expect(screen.queryByRole('list', { name: 'Problemas' })).not.toBeInTheDocument();
  });

  it('com a análise a caminho, o problema acompanha a entrada movida e some com a entrada removida', async () => {
    simulateApi(() => 'pending');
    const draft = exampleDraft({
      problems: [
        problem('reserved_name', 'em é uma palavra reservada e não pode ser nome de variável.', 'root.inputs[1].name'),
        problem('duplicate_name', 'taxa já é o nome de outra variável.', 'root.inputs[2].fields[1].name'),
      ],
    });
    const { user } = renderPanel({ draft, item: INPUTS });
    const nameOf = (input: string) => within(inputItem(input)).getByRole('textbox', { name: /^Nome( \(.+\))?$/ });
    const fieldGroup = (field: string) => within(inputItem('pontuacoes')).getByRole('group', { name: `Campo ${field}` });

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Mover para cima( \(.+\))?$/ }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['categoria', 'valor_item', 'pontuacoes']);
    expect(nameOf('categoria')).toHaveAccessibleDescription(expect.stringContaining('em é uma palavra reservada'));
    expect(nameOf('valor_item')).not.toHaveAttribute('aria-invalid');

    // The field before taxa goes away: the mark stays on taxa, not on the field now in its old place.
    await user.click(within(fieldGroup('valor_compra')).getByRole('button', { name: /^Remover campo( \(.+\))?$/ }));
    expect(within(fieldGroup('taxa')).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ })).toHaveAccessibleDescription(
      expect.stringContaining('taxa já é o nome de outra variável.'),
    );

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Remover entrada' })).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    expect(nameOf('valor_item')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/em é uma palavra reservada/)).not.toBeInTheDocument();
  });

  it('mover e editar mantêm os mesmos objetos (e os mesmos campos na tela) do que não mudou', async () => {
    simulateApi();
    const { user, editor } = renderPanel({ item: INPUTS });
    const [valor, categoria, pontuacoes] = editor().definition.root.inputs;
    const categoriaName = within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ });

    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Mover para cima( \(.+\))?$/ }));
    let inputs = editor().definition.root.inputs;
    expect(inputs[0]).toBe(categoria);
    expect(inputs[1]).toBe(valor);
    expect(inputs[2]).toBe(pontuacoes);
    // The same field on screen, not the neighbour's field with a new value.
    expect(within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toBe(categoriaName);

    await user.type(categoriaName, 's');
    inputs = editor().definition.root.inputs;
    expect(inputs[0]).not.toBe(categoria);
    expect(inputs[0]?.name).toBe('categorias');
    expect(inputs[1]).toBe(valor);
    expect(inputs[2]).toBe(pontuacoes);
    expect(within(inputItem('categorias')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toBe(categoriaName);

    const before = pontuacoes?.cardinality === 'multiple' ? pontuacoes.fields : [];
    const taxa = within(inputItem('pontuacoes')).getByRole('group', { name: 'Campo taxa' });
    await user.type(within(taxa).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ }), 's');
    const after = editor().definition.root.inputs[2];
    expect(after?.cardinality === 'multiple' ? after.fields[0] : null).toBe(before[0]);
    expect(editor().definition.root.inputs[1]).toBe(valor);
  });

  it('digitar num nome é um passo só para desfazer; outro campo é outro passo', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    await user.type(within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ }), '_item');
    await user.type(within(inputItem('valor_item')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ }), '_total');
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item_total', 'categoria_item', 'pontuacoes']);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item', 'categoria_item', 'pontuacoes']);
    expect(within(inputItem('valor_item')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toHaveValue('valor_item');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(currentDefinition().root.inputs.map((input) => input.name)).toEqual(['valor_item', 'categoria', 'pontuacoes']);
  });

  it('avisa o nome repetido já na digitação, e a mudança vai para o rascunho', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const name = within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ });
    await user.tripleClick(name);
    await user.paste('taxa');
    expect(currentDefinition().root.inputs[1]?.name).toBe('taxa');
    expect(name).toHaveAccessibleDescription(expect.stringContaining('Já existe uma variável com este nome.'));
    expect(within(inputItem('valor_item')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).not.toHaveAttribute('aria-invalid');

    await user.type(name, 's');
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('depois de remover, o foco vai para Incluir entrada; ao cancelar, volta ao botão de remover', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS });

    const remove = within(inputItem('categoria')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ });
    await user.click(remove);
    await user.click(within(await screen.findByRole('dialog', { name: 'Remover entrada' })).getByRole('button', { name: 'Cancelar' }));
    // The focus comes back when the dialog's exit ends: the test waits for that event.
    await whenFocused(remove);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const add = screen.getByRole('button', { name: 'Incluir entrada' });
    await user.click(remove);
    await user.click(within(await screen.findByRole('dialog', { name: 'Remover entrada' })).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    await whenFocused(add);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o aviso de remover conta também os campos da saída que mostram a entrada', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.root.output.fields.push({ name: 'valor', variable: 'valor_item' });
    const { user } = renderPanel({ draft, item: INPUTS });

    await user.click(within(inputItem('valor_item')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover entrada' });
    expect(dialog).toHaveTextContent(
      '1 bloco usa esta entrada e passa a mostrar um problema. 1 campo da saída mostra esta entrada e passa a mostrar um problema.',
    );
  });

  it('a seleção põe o foco no campo uma vez só: uma análise nova que muda o path não rouba o foco', async () => {
    const api = simulateApi();
    const { user, editor } = renderPanel({ item: INPUTS, field: 'root.inputs[1].name' });
    await waitFor(() => expect(within(inputItem('categoria')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).toHaveFocus());

    // valor_item goes to the place categoria had: after the analysis, its name is at the selected path.
    const down = within(inputItem('valor_item')).getByRole('button', { name: /^Mover para baixo( \(.+\))?$/ });
    await user.click(down);
    // The analysis of the move comes back (the event that could have moved the focus): the editor is up to date again.
    await waitFor(() => expect(api.analysisBodies()).toHaveLength(1));
    await waitFor(() => expect(editor().problemsOutdated).toBe(false));
    expect(within(inputItem('valor_item')).getByRole('textbox', { name: /^Nome( \(.+\))?$/ })).not.toHaveFocus();
    expect(down).toHaveFocus();
  });

  it('o problema clicado na aba Problemas leva o foco ao campo dele', async () => {
    simulateApi();
    renderPanel({ item: INPUTS, field: 'root.inputs[2].fields[1].name' });
    await waitFor(() =>
      expect(within(screen.getByRole('group', { name: 'Campo taxa' })).getByRole('textbox', { name: /^Nome do campo( \(.+\))?$/ })).toHaveFocus(),
    );
  });

  it('sem entradas, diz o que falta e oferece incluir', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.root.inputs = [];
    const { user } = renderPanel({ draft, item: INPUTS });

    expect(screen.getByText('Nenhuma entrada declarada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Incluir entrada' }));
    expect(currentDefinition().root.inputs).toEqual([{ name: 'entrada_1', cardinality: 'linear', type: 'decimal', scale: 2 }]);
  });

  it('só leitura: tudo desabilitado, com o motivo', async () => {
    simulateApi();
    const { user } = renderPanel({ item: INPUTS, readOnly: true });

    const reason = 'Você não tem permissão para editar este workflow';
    expect(screen.getByText(reason, { selector: 'p > span' })).toBeVisible();
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getAllByRole('radiogroup')[0]).toHaveAccessibleDescription(reason);

    const add = screen.getByRole('button', { name: 'Incluir entrada' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription(reason);
    await user.click(add);
    await user.click(within(inputItem('categoria')).getByRole('button', { name: /^Remover entrada( \(.+\))?$/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentDefinition().root.inputs).toHaveLength(3);
  });

  it('campos de mesmo nome têm nome acessível distinto, com o nome da entrada ou do campo', () => {
    simulateApi();
    renderPanel({ item: INPUTS });

    const names = (role: string, label: RegExp) => screen.getAllByRole(role, { name: label }).map((element) => element.getAttribute('aria-label'));
    expect(names('textbox', /^Nome \(/)).toEqual(['Nome (valor_item)', 'Nome (categoria)', 'Nome (pontuacoes)']);
    const types = screen.getAllByRole('combobox', { name: /^Tipo \(/ });
    expect(types).toHaveLength(4);
    ['Tipo (valor_item)', 'Tipo (categoria)', 'Tipo (valor_compra)', 'Tipo (taxa)'].forEach((name, index) => expect(types[index]).toHaveAccessibleName(name));
    expect(screen.getAllByRole('radiogroup', { name: /^Cardinalidade \(/ })).toHaveLength(3);
    expect(names('button', /^Remover entrada \(/)).toEqual(['Remover entrada (valor_item)', 'Remover entrada (categoria)', 'Remover entrada (pontuacoes)']);
    expect(names('button', /^Mover para cima \(/)).toHaveLength(3);
    expect(names('textbox', /^Nome do campo \(/)).toEqual(['Nome do campo (valor_compra)', 'Nome do campo (taxa)']);
    expect(screen.getByRole('button', { name: 'Incluir campo (pontuacoes)' })).toBeInTheDocument();
  });
});
