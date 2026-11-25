import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, createQueryClient } from '../../api';
import { FluxoRoot } from '../../design-system';
import { AllowedValuesField } from './AllowedValuesField';
import {
  QUERY,
  WORKFLOW_ID,
  allowedValues,
  parameter,
  parameterProblem,
  problem,
  renderScreen,
  simulateAllowedValues,
} from './parameter-form.test-support';

const sent = () => screen.getByLabelText('Enviado').textContent;
const send = () => screen.getByRole('button', { name: 'Enviar' });
const REGIONS = ['Centro-Oeste', 'Nordeste', 'Norte', 'Sudeste', 'Sul'];

afterEach(() => {
  vi.useRealTimers();
});

describe('ParameterForm: valores permitidos por consulta', () => {
  it('abre a busca com os valores da API e envia o escolhido', async () => {
    const api = simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });

    const field = screen.getByRole('combobox', { name: 'regiao' });
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(api.searches).toEqual([]);

    await user.click(field);
    expect(field).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('listbox', { name: 'Valores de regiao' });
    expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual(REGIONS);
    expect(api.searches).toEqual([null]);

    await user.click(within(list).getByRole('option', { name: 'Norte' }));
    expect(field).toHaveValue('Norte');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(send());
    expect(sent()).toBe('{"regiao":"Norte"}');
  });

  it('pede de novo só 300 ms depois da última tecla, com o texto digitado', async () => {
    const api = simulateAllowedValues((search) => allowedValues(search === null ? REGIONS : REGIONS.filter((region) => region.includes(search))));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    await user.click(field);
    await screen.findByRole('option', { name: 'Sul' });
    expect(api.searches).toEqual([null]);

    // The fake clock from here on; moving it also lets the promises the timers started run.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    fireEvent.change(field, { target: { value: 'N' } });
    await tick(200);
    fireEvent.change(field, { target: { value: 'No' } });
    await tick(299);
    // Each key restarts the wait: nothing new was asked yet, and the list on screen stays.
    expect(api.searches).toEqual([null]);
    expect(screen.getByRole('option', { name: 'Sul' })).toBeInTheDocument();

    await tick(1);
    expect(api.searches).toEqual([null, 'No']);
    await tick(0);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Sul' })).not.toBeInTheDocument());
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Nordeste', 'Norte']);
  });

  it('com truncated, avisa que só os primeiros 1.000 aparecem', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS, true));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regiao' }));
    expect(await screen.findByText('Mostrando os primeiros 1.000. Digite para filtrar.')).toBeInTheDocument();
  });

  it('sem truncated, não mostra o aviso', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regiao' }));
    await screen.findByRole('option', { name: 'Sul' });
    expect(screen.queryByText('Mostrando os primeiros 1.000. Digite para filtrar.')).not.toBeInTheDocument();
  });

  it('pelo teclado: seta para baixo abre e move, Enter escolhe sem enviar o formulário, Esc fecha', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    await user.tab();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: 'Sul' });
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Nordeste' }).id);

    await user.keyboard('{Enter}');
    expect(field).toHaveValue('Nordeste');
    expect(sent()).toBe('');

    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: 'Nordeste' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field).toHaveValue('Nordeste');
  });

  it('apagar o texto e sair do campo tira a escolha; texto solto não vira valor', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY, default: { kind: 'fixed', value: '"Sul"' } })] });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    // The fixed default is the choice it starts with.
    expect(field).toHaveValue('Sul');

    await user.click(field);
    await user.clear(field);
    await user.paste('Qualquer');
    await user.tab();
    expect(field).toHaveValue('Sul');

    await user.click(field);
    await user.clear(field);
    await user.tab();
    expect(field).toHaveValue('');
    await user.click(send());
    expect(sent()).toBe('{}');
  });

  it('inteiro e data: mostra no padrão brasileiro e busca pelo texto da API', async () => {
    const api = simulateAllowedValues((_search, name) => allowedValues(name === 'loja' ? ['1500', '2300'] : ['2026-10-01', '2026-11-01']));
    const { user } = renderScreen({
      parameters: [parameter('loja', 'integer', { allowed_values: QUERY }), parameter('corte', 'date', { allowed_values: QUERY })],
    });
    const store = screen.getByRole('combobox', { name: 'loja' });
    await user.click(store);
    await user.click(await screen.findByRole('option', { name: '1.500' }));
    await user.click(screen.getByRole('combobox', { name: 'corte' }));
    await user.click(await screen.findByRole('option', { name: '01/11/2026' }));
    await user.click(send());
    expect(sent()).toBe('{"loja":"1500","corte":"2026-11-01"}');

    await user.click(store);
    await user.clear(store);
    await user.paste('2.3');
    await waitFor(() => expect(api.searches.at(-1)).toBe('23'));
  });

  it('nenhum valor: diz que não há o que escolher', async () => {
    simulateAllowedValues(() => allowedValues([]));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regiao' }));
    expect(await screen.findByText('Nenhum valor encontrado')).toHaveAttribute('role', 'status');
  });

  it('erro de leitura: mostra a mensagem da API e lê de novo em "Tentar de novo"', async () => {
    let attempts = 0;
    const api = simulateAllowedValues(() => {
      attempts += 1;
      return attempts === 1
        ? problem(422, 'schema_drift', 'A coluna uf de Lojas mudou na origem. Ajuste o dataset no catálogo.')
        : allowedValues(REGIONS);
    });
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regiao' }));

    expect(await screen.findByText('Não foi possível ler os valores permitidos')).toBeInTheDocument();
    expect(screen.getByText('A coluna uf de Lojas mudou na origem. Ajuste o dataset no catálogo.')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('option', { name: 'Sul' })).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível ler os valores permitidos')).not.toBeInTheDocument();
    expect(api.searches).toEqual([null, null]);
  });

  it('422 invalid_parameter: "não está entre os valores permitidos" no campo, e some ao escolher outro', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({
      parameters: [parameter('regiao', 'text', { allowed_values: QUERY })],
      answer: parameterProblem('invalid_parameter', { regiao: 'não está entre os valores permitidos' }),
    });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    await user.click(field);
    await user.click(await screen.findByRole('option', { name: 'Norte' }));
    await user.click(send());

    expect(await screen.findByText('não está entre os valores permitidos')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('não está entre os valores permitidos'));
    expect(screen.getByLabelText('Falha')).toHaveTextContent('');

    await user.click(field);
    await user.click(await screen.findByRole('option', { name: 'Sul' }));
    expect(screen.queryByText('não está entre os valores permitidos')).not.toBeInTheDocument();
  });

  it('desabilitado: o campo não abre nem pede valores', async () => {
    const api = simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })], disabled: true });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    expect(field).toBeDisabled();
    await user.click(field);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(api.searches).toEqual([]);
  });

  describe('numa lista, várias escolhas', () => {
    it('cada escolha vira uma etiqueta; a lista segue aberta e envia na ordem das escolhas', async () => {
      simulateAllowedValues(() => allowedValues(REGIONS));
      const { user } = renderScreen({ parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })] });
      const field = screen.getByRole('combobox', { name: 'regioes' });
      await user.click(field);
      const list = await screen.findByRole('listbox', { name: 'Valores de regioes' });
      expect(list).toHaveAttribute('aria-multiselectable', 'true');

      await user.click(within(list).getByRole('option', { name: 'Sul' }));
      await user.click(within(list).getByRole('option', { name: 'Norte' }));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(within(list).getByRole('option', { name: 'Sul' })).toHaveAttribute('aria-selected', 'true');
      expect(within(list).getByRole('option', { name: 'Nordeste' })).toHaveAttribute('aria-selected', 'false');

      const tags = screen.getByRole('list', { name: 'Valores escolhidos de regioes' });
      expect(within(tags).getAllByRole('listitem').map((tag) => tag.textContent)).toEqual(['Sul', 'Norte']);

      await user.click(send());
      expect(sent()).toBe('{"regioes":["Sul","Norte"]}');
    });

    it('escolher de novo tira o valor, e "Remover" na etiqueta também', async () => {
      simulateAllowedValues(() => allowedValues(REGIONS));
      const { user } = renderScreen({ parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })] });
      await user.click(screen.getByRole('combobox', { name: 'regioes' }));
      await user.click(await screen.findByRole('option', { name: 'Sul' }));
      await user.click(screen.getByRole('option', { name: 'Norte' }));
      await user.click(screen.getByRole('option', { name: 'Centro-Oeste' }));

      await user.click(screen.getByRole('option', { name: 'Sul' }));
      await user.click(screen.getByRole('button', { name: 'Remover Norte' }));
      await user.click(send());
      expect(sent()).toBe('{"regioes":["Centro-Oeste"]}');
    });

    it('pelo teclado, Enter acrescenta o valor ativo', async () => {
      simulateAllowedValues(() => allowedValues(REGIONS));
      const { user } = renderScreen({ parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })] });
      await user.click(screen.getByRole('combobox', { name: 'regioes' }));
      await screen.findByRole('option', { name: 'Sul' });
      await user.keyboard('{ArrowUp}{Enter}{ArrowUp}{Enter}');
      await user.click(send());
      expect(sent()).toBe('{"regioes":["Sul","Sudeste"]}');
    });

    it('422 de um item fora dos permitidos aparece no campo da lista', async () => {
      simulateAllowedValues(() => allowedValues(REGIONS));
      const { user } = renderScreen({
        parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })],
        answer: parameterProblem('invalid_parameter', { regioes: 'não está entre os valores permitidos' }),
      });
      await user.click(screen.getByRole('combobox', { name: 'regioes' }));
      await user.click(await screen.findByRole('option', { name: 'Sul' }));
      await user.click(send());
      expect(await screen.findByText('não está entre os valores permitidos')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'regioes' })).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

describe('ParameterForm: a lista antiga durante a busca', () => {
  it('enquanto espera os 300 ms e a busca responde, Enter e as setas não escolhem um valor que não bate com o texto', async () => {
    let answerSearch: (response: Response) => void = () => {};
    const api = simulateAllowedValues((search) =>
      search === null ? allowedValues(REGIONS) : new Promise<Response>((resolve) => (answerSearch = resolve)),
    );
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    const field = screen.getByRole('combobox', { name: 'regiao' });
    await user.click(field);
    await screen.findByRole('option', { name: 'Sul' });

    // Typed, and the 300 ms have not passed: the list of the empty text is still there, but nothing in it is active.
    fireEvent.change(field, { target: { value: 'No' } });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('No');
    expect(field).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByText('Carregando valores')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sul' })).toHaveAttribute('aria-disabled', 'true');

    // The search is in flight (nothing answered yet): same thing.
    await waitFor(() => expect(api.searches).toEqual([null, 'No']));
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('No');
    expect(screen.getByText('Carregando valores')).toBeInTheDocument();

    // The answer arrives: the list is the one of the text, active.
    await act(async () => answerSearch(allowedValues(['Nordeste', 'Norte'])));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Sul' })).not.toBeInTheDocument());
    expect(screen.queryByText('Carregando valores')).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('Nordeste');
  });

  it('o popup não deixa o campo perder o foco ao apertar "Tentar de novo" (Safari não foca o botão)', async () => {
    simulateAllowedValues(() => problem(500, 'internal_error', 'Falhou ao ler.'));
    const { user } = renderScreen({ parameters: [parameter('regiao', 'text', { allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regiao' }));

    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    // `fireEvent` answers false when the event was default-prevented: the browser does not move the focus off the field.
    expect(fireEvent.mouseDown(retry)).toBe(false);
  });

  it('o mesmo vale para "Remover" na etiqueta de uma escolha', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regioes' }));
    await user.click(await screen.findByRole('option', { name: 'Sul' }));

    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Remover Sul' }))).toBe(false);
  });
});

describe('AllowedValuesField: sair do campo', () => {
  function renderField(onBlur: () => void) {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const queryClient = createQueryClient();
    const user = userEvent.setup({ delay: null });
    render(
      <FluxoRoot>
        <ApiProvider apiUrl="https://api.teste">
          <QueryClientProvider client={queryClient}>
            <AllowedValuesField
              workflowId={WORKFLOW_ID}
              name="regiao"
              type="text"
              help="Texto"
              multiple={false}
              selected={[]}
              onChange={() => {}}
              onBlur={onBlur}
            />
            <button type="button">Outro</button>
          </QueryClientProvider>
        </ApiProvider>
      </FluxoRoot>,
    );
    return user;
  }

  it('avisa o formulário, que passa a mostrar o erro do campo (como os outros campos)', async () => {
    const onBlur = vi.fn();
    const user = renderField(onBlur);

    await user.click(screen.getByRole('combobox', { name: 'regiao' }));
    await screen.findByRole('option', { name: 'Sul' });
    expect(onBlur).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Outro' }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('ParameterForm: ícone da etiqueta', () => {
  it('o ícone de remover usa o tamanho do ícone em botão pequeno (14, estilos §6) e é decorativo', async () => {
    simulateAllowedValues(() => allowedValues(REGIONS));
    const { user } = renderScreen({ parameters: [parameter('regioes', 'text', { list: true, allowed_values: QUERY })] });
    await user.click(screen.getByRole('combobox', { name: 'regioes' }));
    await user.click(await screen.findByRole('option', { name: 'Sul' }));

    const icon = screen.getByRole('button', { name: 'Remover Sul' }).querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
    expect(icon).toHaveAttribute('height', '14');
  });
});
