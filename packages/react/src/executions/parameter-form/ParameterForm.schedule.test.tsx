import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../api';
import { relativesFor } from './labels';
import { QUERY, allowedValues, parameter, parameterProblem, renderScreen, simulateAllowedValues } from './parameter-form.test-support';
import { scheduleFormValues } from './values';

const sent = () => screen.getByLabelText('Enviado').textContent;
const send = () => screen.getByRole('button', { name: 'Enviar' });
const kind = (name: string) => screen.queryByRole('radiogroup', { name: `Valor de ${name}` });

describe('ParameterForm: modo agendamento', () => {
  describe('o Relativo só aparece no tipo que tem', () => {
    it.each([
      ['text', {}],
      ['integer', {}],
      ['decimal', { scale: 2 }],
      ['boolean', {}],
    ] as const)('%s: só o valor fixo, sem Fixo | Relativo', (type, extra) => {
      renderScreen({ mode: 'schedule', parameters: [parameter('valor', type, extra)] });
      expect(kind('valor')).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Relativo' })).not.toBeInTheDocument();
    });

    it('lista de datas: sem Relativo', () => {
      renderScreen({ mode: 'schedule', parameters: [parameter('dias', 'date', { list: true })] });
      expect(kind('dias')).not.toBeInTheDocument();
    });

    it.each([
      ['date', ['Hoje', 'Ontem', 'Primeiro dia do mês atual', 'Primeiro dia do mês anterior', 'Último dia do mês anterior']],
      ['datetime', ['Agora']],
      ['period', ['Mês atual', 'Mês anterior', 'Últimos 7 dias', 'Últimos 30 dias']],
    ] as const)('%s: Fixo | Relativo, e no Relativo só os relativos do tipo', async (type, labels) => {
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('quando', type)] });
      const group = kind('quando');
      expect(group).toBeInTheDocument();
      expect(within(group!).getByRole('radio', { name: 'Fixo' })).toBeChecked();

      await user.click(within(group!).getByRole('radio', { name: 'Relativo' }));
      await user.click(screen.getByRole('combobox', { name: 'quando' }));
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(labels);
    });
  });

  describe('envio no formato de Contratos ({kind, value})', () => {
    it('data relativa: envia {kind: relative} com o primeiro relativo; trocar envia o escolhido', async () => {
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('corte', 'date')] });
      await user.click(screen.getByRole('radio', { name: 'Relativo' }));
      await user.click(send());
      expect(sent()).toBe('{"corte":{"kind":"relative","value":"today"}}');

      await user.click(screen.getByRole('combobox', { name: 'corte' }));
      await user.click(await screen.findByRole('option', { name: 'Último dia do mês anterior' }));
      await user.click(send());
      expect(sent()).toBe('{"corte":{"kind":"relative","value":"last_day_of_previous_month"}}');
    });

    it('data fixa: envia {kind: fixed} com aaaa-mm-dd', async () => {
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('corte', 'date')] });
      fireEvent.change(screen.getByLabelText('corte'), { target: { value: '2026-10-05' } });
      await user.click(send());
      expect(sent()).toBe('{"corte":{"kind":"fixed","value":"2026-10-05"}}');
    });

    it('data e hora: Relativo envia now; Fixo envia ISO 8601 em UTC', async () => {
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('momento', 'datetime')] });
      fireEvent.change(screen.getByLabelText('momento'), { target: { value: '2026-10-05T10:30:00' } });
      await user.click(send());
      expect(sent()).toBe(`{"momento":{"kind":"fixed","value":"${new Date('2026-10-05T10:30:00').toISOString()}"}}`);

      await user.click(screen.getByRole('radio', { name: 'Relativo' }));
      await user.click(send());
      expect(sent()).toBe('{"momento":{"kind":"relative","value":"now"}}');
    });

    it('período: Fixo com as duas datas; Relativo com o período escolhido', async () => {
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('periodo', 'period')] });
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-10-31' } });
      await user.click(send());
      expect(sent()).toBe('{"periodo":{"kind":"fixed","value":{"start":"2026-10-01","end":"2026-10-31"}}}');

      await user.click(screen.getByRole('radio', { name: 'Relativo' }));
      await user.click(screen.getByRole('combobox', { name: 'periodo' }));
      await user.click(await screen.findByRole('option', { name: 'Mês anterior' }));
      await user.click(send());
      expect(sent()).toBe('{"periodo":{"kind":"relative","value":"previous_month"}}');
    });

    it('texto, número, booleano e lista: sempre {kind: fixed}; o vazio não é enviado', async () => {
      const { user } = renderScreen({
        mode: 'schedule',
        parameters: [
          parameter('regiao', 'text'),
          parameter('meta', 'decimal', { scale: 2 }),
          parameter('ativo', 'boolean'),
          parameter('lojas', 'integer', { list: true }),
          parameter('filial', 'text'),
        ],
      });
      await user.click(screen.getByLabelText('regiao'));
      await user.paste('Norte');
      await user.click(screen.getByLabelText('meta'));
      await user.paste('1.500,5');
      await user.click(screen.getByRole('combobox', { name: 'ativo' }));
      await user.click(await screen.findByRole('option', { name: 'Falso' }));
      await user.click(screen.getByLabelText('lojas'));
      await user.paste('10');
      await user.keyboard('{Enter}');
      await user.click(send());
      expect(sent()).toBe(
        '{"regiao":{"kind":"fixed","value":"Norte"},"meta":{"kind":"fixed","value":"1500.5"},"ativo":{"kind":"fixed","value":false},"lojas":{"kind":"fixed","value":["10"]}}',
      );
    });

    it('consulta: o Fixo é a busca nos valores da API', async () => {
      simulateAllowedValues(() => allowedValues(['2026-10-01', '2026-11-01']));
      const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('corte', 'date', { allowed_values: QUERY })] });
      expect(kind('corte')).toBeInTheDocument();
      await user.click(screen.getByRole('combobox', { name: 'corte' }));
      await user.click(await screen.findByRole('option', { name: '01/10/2026' }));
      await user.click(send());
      expect(sent()).toBe('{"corte":{"kind":"fixed","value":"2026-10-01"}}');
    });
  });

  describe('o padrão da declaração', () => {
    it('relativo: começa em Relativo, no relativo declarado, e o envia', async () => {
      const { user } = renderScreen({
        mode: 'schedule',
        parameters: [parameter('periodo', 'period', { default: { kind: 'relative', value: 'previous_month' } })],
      });
      expect(screen.getByRole('radio', { name: 'Relativo' })).toBeChecked();
      expect(screen.getByRole('combobox', { name: 'periodo' })).toHaveTextContent('Mês anterior');
      // No "Trocar por um valor fixo" here: Fixo | Relativo is the choice.
      expect(screen.queryByRole('button', { name: 'Trocar por um valor fixo' })).not.toBeInTheDocument();
      await user.click(send());
      expect(sent()).toBe('{"periodo":{"kind":"relative","value":"previous_month"}}');

      await user.click(screen.getByRole('radio', { name: 'Fixo' }));
      expect(screen.getByLabelText('Início')).toHaveValue('');
      await user.click(send());
      expect(sent()).toBe('{}');

      // Back to Relativo, the declared relative comes again.
      await user.click(screen.getByRole('radio', { name: 'Relativo' }));
      expect(screen.getByRole('combobox', { name: 'periodo' })).toHaveTextContent('Mês anterior');
    });

    it('fixo: começa em Fixo, com o valor declarado', async () => {
      const { user } = renderScreen({
        mode: 'schedule',
        parameters: [parameter('corte', 'date', { default: { kind: 'fixed', value: 'DATA(2026, 10, 1)' } })],
      });
      expect(screen.getByRole('radio', { name: 'Fixo' })).toBeChecked();
      expect(screen.getByLabelText('corte')).toHaveValue('2026-10-01');
      await user.click(send());
      expect(sent()).toBe('{"corte":{"kind":"fixed","value":"2026-10-01"}}');
    });
  });

  it('pelo teclado: as setas trocam entre Fixo e Relativo', async () => {
    const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('corte', 'date')] });
    screen.getByRole('radio', { name: 'Fixo' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Relativo' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'corte' })).toHaveTextContent('Hoje');
  });

  it('de Relativo para Fixo e de volta, o relativo escolhido continua o mesmo', async () => {
    const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('periodo', 'period')] });
    await user.click(screen.getByRole('radio', { name: 'Relativo' }));
    await user.click(screen.getByRole('combobox', { name: 'periodo' }));
    await user.click(await screen.findByRole('option', { name: 'Últimos 7 dias' }));

    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    await user.click(screen.getByRole('radio', { name: 'Relativo' }));

    expect(screen.getByRole('combobox', { name: 'periodo' })).toHaveTextContent('Últimos 7 dias');
    await user.click(send());
    expect(sent()).toBe('{"periodo":{"kind":"relative","value":"last_7_days"}}');
  });

  it('o erro de um Fixo já tocado não volta com ele depois do Relativo', async () => {
    const { user } = renderScreen({ mode: 'schedule', parameters: [parameter('periodo', 'period')] });
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-01' } });
    fireEvent.blur(screen.getByLabelText('Início'));
    expect(await screen.findByText('Informe o início e o fim do período.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Relativo' }));
    await user.click(screen.getByRole('radio', { name: 'Fixo' }));

    expect(screen.getByLabelText('Início')).toHaveValue('2026-10-01');
    expect(screen.queryByText('Informe o início e o fim do período.')).not.toBeInTheDocument();
  });

  it('retoma um agendamento salvo (scheduleFormValues)', async () => {
    const parameters = [
      parameter('periodo', 'period'),
      parameter('meta', 'decimal', { scale: 2 }),
      parameter('momento', 'datetime'),
      parameter('regioes', 'text', { list: true }),
      parameter('filial', 'text', { default: { kind: 'fixed', value: '"Centro"' } }),
    ];
    const saved: Record<string, Schemas['ScheduleParameter']> = {
      periodo: { kind: 'relative', value: 'last_7_days' },
      meta: { kind: 'fixed', value: '1500.50' },
      momento: { kind: 'fixed', value: '2026-10-05T13:30:00.000Z' },
      regioes: { kind: 'fixed', value: ['Norte', 'Sul'] },
    };
    const { user } = renderScreen({ mode: 'schedule', parameters, initial: scheduleFormValues(parameters, saved) });

    expect(within(kind('periodo')!).getByRole('radio', { name: 'Relativo' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'periodo' })).toHaveTextContent('Últimos 7 dias');
    expect(screen.getByLabelText('meta')).toHaveValue('1.500,50');
    expect(within(kind('momento')!).getByRole('radio', { name: 'Fixo' })).toBeChecked();
    expect(within(screen.getByRole('list', { name: 'Valores de regioes' })).getAllByRole('listitem')).toHaveLength(2);
    // What the schedule does not have starts as the declaration says.
    expect(screen.getByLabelText('filial')).toHaveValue('Centro');

    await user.click(send());
    expect(JSON.parse(sent() ?? '')).toEqual({ ...saved, filial: { kind: 'fixed', value: 'Centro' } });
  });

  it('422 invalid_parameter no campo do parâmetro, também no Relativo', async () => {
    const { user } = renderScreen({
      mode: 'schedule',
      parameters: [parameter('corte', 'date', { required: true })],
      answer: parameterProblem('invalid_parameter', { corte: 'não está entre os valores permitidos' }),
    });
    await user.click(screen.getByRole('radio', { name: 'Relativo' }));
    await user.click(send());
    expect(await screen.findByText('não está entre os valores permitidos')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'corte' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('desabilitado: Fixo e Relativo também', () => {
    renderScreen({ mode: 'schedule', parameters: [parameter('corte', 'date')], disabled: true });
    expect(screen.getByRole('radio', { name: 'Fixo' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Relativo' })).toBeDisabled();
  });

  it('relativesFor: lista nunca tem relativo', () => {
    expect(relativesFor({ type: 'date', list: true })).toEqual([]);
    expect(relativesFor({ type: 'text', list: false })).toEqual([]);
    expect(relativesFor({ type: 'datetime', list: false })).toEqual(['now']);
  });
});
