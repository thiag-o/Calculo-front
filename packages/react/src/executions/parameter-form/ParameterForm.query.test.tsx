import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QUERY,
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
