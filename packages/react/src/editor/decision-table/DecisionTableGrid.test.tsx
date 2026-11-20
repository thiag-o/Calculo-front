import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_PASTE_LENGTH } from './clipboard';
import { DecisionTableGrid } from './DecisionTableGrid';
import { TABLE_ID, cellsOf, problemAt, renderWithDraft, table } from './decision-table.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderGrid(options: Parameters<typeof renderWithDraft>[1] = {}) {
  const onClose = vi.fn();
  const rendered = renderWithDraft(<DecisionTableGrid nodeId={TABLE_ID} onClose={onClose} />, options);
  return { ...rendered, onClose };
}

/** The cell of a rule (from 1) and a column (from 1, conditions first), as the grid draws it. */
function cell(rule: number, column: number): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => candidate.getAttribute('aria-rowindex') === String(rule + 2));
  if (!row) throw new Error(`regra ${rule} não está na grade`);
  const found = within(row)
    .getAllByRole('gridcell')
    .find((candidate) => candidate.getAttribute('aria-colindex') === String(column + 1));
  if (!found) throw new Error(`coluna ${column} não está na regra ${rule}`);
  return found;
}

/** Simulates pasting text copied from Excel on the focused element. */
function paste(text: string) {
  const target = document.activeElement as HTMLElement;
  fireEvent.paste(target, { clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') } });
}

describe('DecisionTableGrid', () => {
  it('mostra as condições e os resultados separados, as regras numeradas a partir de 1 e a célula vazia com "-"', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: 'Regras de Elegibilidade' });
    expect(grid).toHaveAttribute('aria-rowcount', '5');
    expect(grid).toHaveAttribute('aria-colcount', '5');

    expect(screen.getByRole('columnheader', { name: 'Condições' })).toHaveAttribute('aria-colspan', '2');
    const results = screen.getByRole('columnheader', { name: 'Resultados' });
    expect(results).toHaveAttribute('aria-colspan', '2');
    expect(results).toHaveClass('fc-dt-divider');
    const fator = screen.getByRole('columnheader', { name: 'Resultado 2: fator, decimal(4)' });
    const elegivel = screen.getByRole('columnheader', { name: 'Resultado 1: elegivel, boolean' });
    expect(elegivel).toHaveClass('fc-dt-divider');
    expect(screen.getByRole('columnheader', { name: 'Condição 1: categoria' })).toHaveAttribute('aria-colindex', '2');

    expect(screen.getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Regra 1', 'Regra 2', 'Regra 3']);
    // The cell sits under its header: the same column index.
    expect(cell(1, 4)).toHaveAttribute('aria-colindex', fator.getAttribute('aria-colindex'));
    expect(cell(1, 4)).toHaveTextContent('0.15');
    expect(cell(1, 1)).toHaveTextContent('"A"');

    const empty = cell(2, 2);
    expect(empty).toHaveTextContent('-vazia');
    expect(within(empty).getByText('-')).toHaveClass('fc-dt-empty');
    // "-" typed in a condition is a value (any value), shown as typed.
    expect(within(cell(3, 1)).getByText('-')).toHaveClass('fc-dt-value');
  });

  it('abre com o foco na primeira célula, e as setas, Home, End e Tab andam pela grade', async () => {
    const { user } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    expect(cell(1, 1)).toHaveAttribute('tabindex', '0');
    expect(cell(1, 2)).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(cell(2, 2)).toHaveFocus();
    await user.keyboard('{End}');
    expect(cell(2, 4)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(cell(2, 1)).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(cell(3, 4)).toHaveFocus();
    await user.keyboard('{Control>}{Home}{/Control}');
    expect(cell(1, 1)).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(cell(1, 1)).toHaveFocus();

    // Tab goes right and, at the end of the rule, to the first cell of the next one.
    await user.keyboard('{End}{Tab}');
    expect(cell(2, 1)).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(cell(1, 4)).toHaveFocus();
  });

  it('digitar numa célula substitui o texto, Enter grava e desce, e as setas saem da célula', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    await user.keyboard('"C"');
    const input = screen.getByRole('textbox', { name: 'Regra 1, Condição 1: categoria' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('"C"');
    expect(cellsOf(probe.table())[0]![0]).toBe('"C"');

    await user.keyboard('{Enter}');
    expect(cell(2, 1)).toHaveFocus();
    expect(cell(1, 1)).toHaveTextContent('"C"');

    await user.keyboard('>= 10{ArrowRight}');
    expect(cell(2, 2)).toHaveFocus();
    expect(cellsOf(probe.table())[1]![0]).toBe('>= 10');
  });

  it('F2 e Enter editam mantendo o texto, Esc desfaz a edição e Delete limpa a célula', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    await user.keyboard('{End}{F2}');
    const input = screen.getByRole('textbox', { name: 'Regra 1, Resultado 2: fator' });
    expect(input).toHaveValue('0.15');
    await user.keyboard('0');
    expect(probe.table().rules[0]!.then[1]).toBe('0.150');
    // Arrows move the caret while editing with F2.
    await user.keyboard('{ArrowLeft}');
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(cell(1, 4)).toHaveFocus();
    expect(probe.table().rules[0]!.then[1]).toBe('0.15');

    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Regra 1, Resultado 2: fator' })).toHaveValue('0.15');
    await user.keyboard('5{Tab}');
    expect(cell(2, 1)).toHaveFocus();
    expect(probe.table().rules[0]!.then[1]).toBe('0.155');

    await user.keyboard('{Delete}');
    expect(probe.table().rules[1]!.when[0]).toBe('');
    expect(cell(2, 1)).toHaveTextContent('-vazia');
  });

  it('Esc numa célula e "Voltar ao canvas" fecham a grade', async () => {
    const { user, onClose } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Voltar ao canvas' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cola um bloco 3 × 2 do Excel a partir da célula ativa', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{ArrowRight}');

    paste('"X"\tverdadeiro\r\n"Y"\tfalso\r\n"Z"\t-\r\n');

    // Two columns from "Condição 2": the second one goes into "Resultado 1".
    expect(cellsOf(probe.table())).toEqual([
      ['"A"', '"X"', 'verdadeiro', '0.15'],
      ['"B"', '"Y"', 'falso', '0.10'],
      ['-', '"Z"', '-', '0'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('3 × 2 células coladas.');
    expect(cell(1, 2)).toHaveFocus();
  });

  it('colar um bloco que passa do fim acrescenta regras, e as colunas além da última ficam de fora', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{ArrowDown}{ArrowDown}{End}{ArrowLeft}');
    expect(cell(3, 3)).toHaveFocus();

    paste('falso\t0.01\textra\nverdadeiro\t0.02\nverdadeiro\t0.03\n');

    expect(cellsOf(probe.table())).toEqual([
      ['"A"', 'verdadeiro', 'verdadeiro', '0.15'],
      ['"B"', '', 'verdadeiro', '0.10'],
      ['-', '-', 'falso', '0.01'],
      ['', '', 'verdadeiro', '0.02'],
      ['', '', 'verdadeiro', '0.03'],
    ]);
    expect(screen.getAllByRole('rowheader')).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 × 2 células coladas. 2 regras incluídas. 1 coluna ficou de fora: a tabela não tem mais colunas à direita.',
    );
  });

  it('colar um valor só numa célula troca o texto dela, e colar enquanto digita põe o texto no campo', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    paste('"Q"\r\n');
    expect(probe.table().rules[0]!.when[0]).toBe('"Q"');
    expect(probe.table().rules).toHaveLength(3);

    // A block pasted while typing goes to the cells.
    await user.keyboard('{F2}');
    paste('"R"\tfalso');
    expect(cellsOf(probe.table())[0]!.slice(0, 2)).toEqual(['"R"', 'falso']);
  });

  it('colagem acima de 2 MB é recusada com aviso, sem mudar a tabela', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    const before = probe.definition;
    await user.keyboard('{F2}');

    paste(`${'a'.repeat(MAX_PASTE_LENGTH)}\tb`);

    expect(probe.definition).toBe(before);
    expect(screen.getByRole('status')).toHaveTextContent('Colagem grande demais: o limite é de 2 MB de texto. Cole um bloco menor.');
  });

  it('colar centenas de milhares de linhas guarda só as 500 regras que cabem e conta o que ficou de fora', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{End}');

    paste('1\t2\n'.repeat(300000));

    const rules = probe.table().rules;
    expect(rules).toHaveLength(500);
    expect(rules[0]!.then).toEqual(['verdadeiro', '1']);
    expect(rules[499]!.then).toEqual(['', '1']);
    expect(screen.getByRole('status')).toHaveTextContent(
      '500 × 1 células coladas. 497 regras incluídas. 299500 linhas ficaram de fora: o limite é de 500 regras. 1 coluna ficou de fora: a tabela não tem mais colunas à direita.',
    );
  });

  it('ao colar, as quebras de linha dentro da célula viram espaço e os caracteres de controle somem', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    paste('"linha 1\r\nlinha ""2"""\t\u0000a\u001Bb\u2028c\u2029d\uFEFF\u007F\r\n');
    expect(cellsOf(probe.table())[0]!.slice(0, 2)).toEqual(['linha 1 linha "2"', 'abcd']);

    // A single value pasted into the field being typed in is cleaned too.
    await user.keyboard('{ArrowDown}{F2}');
    await user.paste('x\u0000y\u001Bz');
    expect(probe.table().rules[1]!.when[0]).toBe('"B"xyz');
  });

  it('Tab e Shift+Tab na edição da última e da primeira célula saem da grade, com o texto gravado', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    const grid = screen.getByRole('grid');

    await user.keyboard('{Control>}{End}{/Control}9{Tab}');
    expect(grid).not.toContainElement(document.activeElement as HTMLElement);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(probe.table().rules[2]!.then[1]).toBe('9');

    await user.click(cell(1, 1));
    await user.keyboard('{F2}{Shift>}{Tab}{/Shift}');
    expect(grid).not.toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Remover coluna' })).toHaveFocus();
  });

  it('Esc sem mudança não grava passo no histórico', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{F2}{Escape}');
    expect(cell(1, 1)).toHaveFocus();
    expect(probe.canUndo).toBe(false);
  });

  it('enquanto a análise da última mudança não volta, a mensagem do problema fica ocupada', async () => {
    const message = 'operador > não serve para texto.';
    const { user } = renderGrid({ problems: [problemAt('.rules[0].when[0]', message, 'operator_not_allowed')] });
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    expect(cell(1, 1)).toHaveAccessibleDescription(message);
    // The busy flag goes on the live region (role=status), not on the message that describes the cell.
    const liveRegion = screen.getByRole('status');
    const messageBox = document.getElementById(cell(1, 1).getAttribute('aria-describedby') ?? '');
    expect(liveRegion).not.toHaveAttribute('aria-busy');

    await user.keyboard('{Delete}');
    expect(liveRegion).toHaveAttribute('aria-busy', 'true');
    expect(messageBox).not.toHaveAttribute('aria-busy');
    await waitFor(() => expect(liveRegion).not.toHaveAttribute('aria-busy'), { timeout: 4000 });
  });

  it('a tecla que começa a digitar passa pela limpeza: caractere de controle não entra no rascunho', async () => {
    const { probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    const before = cellsOf(probe.table())[0]![0];
    fireEvent.keyDown(cell(1, 1), { key: '\u0007' });
    expect(cellsOf(probe.table())[0]![0]).toBe('');
    expect(before).not.toBe('');
  });

  it('copia a célula ativa como texto', async () => {
    const { user } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    await user.keyboard('{End}');
    const setData = vi.fn();
    fireEvent.copy(cell(1, 4), { clipboardData: { setData, getData: () => '' } });
    expect(setData).toHaveBeenCalledWith('text/plain', '0.15');
  });

  it('inclui, remove e move regras pelos botões e por Alt + seta', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Incluir regra' }));
    expect(cellsOf(probe.table())[1]).toEqual(['', '', '', '']);
    expect(probe.table().rules).toHaveLength(4);
    expect(cell(2, 1)).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Regra 2 incluída');

    await user.click(screen.getByRole('button', { name: 'Remover regra' }));
    expect(cellsOf(probe.table()).map((cells) => cells[0])).toEqual(['"A"', '"B"', '-']);

    // The active rule is now the 2nd ("B"): down with the button, up with Alt + ↑.
    await user.click(screen.getByRole('button', { name: 'Mover regra para baixo' }));
    expect(cellsOf(probe.table()).map((cells) => cells[0])).toEqual(['"A"', '-', '"B"']);
    expect(screen.getByRole('button', { name: 'Mover regra para baixo' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Esta já é a última regra')).toBeInTheDocument();

    await user.click(cell(3, 1));
    await user.keyboard('{Alt>}{ArrowUp}{ArrowUp}{/Alt}');
    expect(cellsOf(probe.table()).map((cells) => cells[0])).toEqual(['"B"', '"A"', '-']);
    expect(cell(1, 1)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Mover regra para cima' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(cellsOf(probe.table()).map((cells) => cells[0])).toEqual(['"A"', '"B"', '-']);
    expect(cell(2, 1)).toHaveFocus();
  });

  it('inclui e remove colunas de condição e de resultado, com as células de cada regra', async () => {
    const { user, probe } = renderGrid();
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Incluir condição' }));
    expect(probe.table().conditions.map((condition) => condition.expression)).toEqual(['categoria', 'meta_atingida', '']);
    expect(probe.table().rules.every((rule) => rule.when.length === 3)).toBe(true);
    expect(screen.getByRole('columnheader', { name: 'Condição 3, sem fórmula' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Incluir resultado' }));
    // resultado_1 is taken by another block: the next free name, with the workflow's decimal places.
    expect(probe.table().results[2]).toEqual({ name: 'resultado_2', type: 'decimal', scale: 2, default_value: null });
    expect(probe.table().rules.every((rule) => rule.then.length === 3)).toBe(true);

    // The active column is the new result: "Remover coluna" takes it away.
    await user.click(screen.getByRole('button', { name: 'Remover coluna' }));
    expect(probe.table().results.map((result) => result.name)).toEqual(['elegivel', 'fator']);

    await user.click(cell(1, 1));
    await user.click(screen.getByRole('button', { name: 'Remover coluna' }));
    expect(probe.table().conditions.map((condition) => condition.expression)).toEqual(['meta_atingida', '']);
    expect(cellsOf(probe.table())[0]).toEqual(['verdadeiro', '', 'verdadeiro', '0.15']);
  });

  it('marca a célula com problema pelo path, com a mensagem ao focar, e a marca acompanha a regra movida', async () => {
    const message = '"A" é texto e não cabe na coluna fator (decimal).';
    const { user, probe } = renderGrid({ problems: [problemAt('.rules[0].then[1]', message, 'output_type_mismatch')] });
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    const invalid = cell(1, 4);
    expect(invalid).toHaveAttribute('aria-invalid', 'true');
    expect(invalid).toHaveClass('fc-dt-invalid');
    expect(cell(1, 3)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(message)).not.toBeInTheDocument();

    await user.keyboard('{End}');
    expect(invalid).toHaveFocus();
    expect(invalid).toHaveAccessibleDescription(message);

    // Moved down before the new analysis: the mark goes with the rule.
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(probe.table().rules[1]!.then[1]).toBe('0.15');
    expect(cell(2, 4)).toHaveAttribute('aria-invalid', 'true');
    expect(cell(1, 4)).not.toHaveAttribute('aria-invalid');
    expect(cell(2, 4)).toHaveAccessibleDescription(message);
  });

  it('um problema escolhido na aba Problemas leva o foco à célula dele', async () => {
    const message = 'operador > não serve para texto.';
    const { probe } = renderGrid({ problems: [problemAt('.rules[2].when[0]', message, 'operator_not_allowed')] });
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());

    act(() => probe.select({ type: 'node', id: TABLE_ID }, 'root.nodes[1].rules[2].when[0]'));
    await waitFor(() => expect(cell(3, 1)).toHaveFocus());
    expect(cell(3, 1)).toHaveAccessibleDescription(message);
  });

  it('mostra o problema da regra inteira no número dela', async () => {
    const message = 'A regra 2 tem 3 células, e a tabela tem 4 colunas.';
    const { user } = renderGrid({ problems: [problemAt('.rules[1]', message, 'rule_width')] });
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    expect(screen.getAllByRole('rowheader')[1]).toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{ArrowDown}');
    expect(cell(2, 1)).toHaveAccessibleDescription(message);
  });

  it('só leitura: navega, mas não edita, não cola e não mostra as ações', async () => {
    const { user, probe } = renderGrid({ readOnly: true });
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
    const before = probe.definition;

    expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByText(/Você não tem permissão para editar este workflow/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incluir regra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

    await user.keyboard('x{F2}{Enter}{Delete}{Alt>}{ArrowDown}{/Alt}');
    paste('1\t2\n3\t4\n');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(probe.definition).toBe(before);

    await user.keyboard('{ArrowRight}');
    expect(cell(1, 2)).toHaveFocus();
  });

  it('sem regras, mostra o estado vazio com "Incluir regra"', async () => {
    const { user, probe } = renderGrid({ node: table({ rules: [] }) });
    expect(screen.getByText('Nenhuma regra ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover regra' })).toHaveAttribute('aria-disabled', 'true');
    const buttons = screen.getAllByRole('button', { name: 'Incluir regra' });
    await user.click(buttons[buttons.length - 1]!);
    expect(probe.table().rules).toEqual([{ when: ['', ''], then: ['', ''] }]);
    await waitFor(() => expect(cell(1, 1)).toHaveFocus());
  });

  it('sem colunas, pede uma condição e um resultado', () => {
    renderGrid({ node: table({ conditions: [], results: [], rules: [] }) });
    expect(screen.getByText('Nenhuma coluna ainda')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover coluna' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('a tabela que sumiu do rascunho mostra o aviso e o caminho de volta', async () => {
    const onClose = vi.fn();
    const { user } = renderWithDraft(<DecisionTableGrid nodeId="td_outra" onClose={onClose} />);
    expect(screen.getByText('Esta Tabela de Decisão não existe mais')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar ao canvas' }));
    expect(onClose).toHaveBeenCalled();
  });
});
