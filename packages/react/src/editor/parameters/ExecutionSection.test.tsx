import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { READ_ONLY_REASON } from '../draft';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from '../properties/properties.test-support';
import { PERCENT_RULE_MESSAGE, PRE_VALIDATION_ALERT_NOTE } from './parameterRules';

vi.mock('../../formula', async (original) => ({ ...(await original<typeof import('../../formula')>()), FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ALERT = /Alerta de campos vazios/;

describe('Execução: alerta de campos vazios da pré-validação', () => {
  it('mostra o limite do rascunho no padrão brasileiro, com a explicação', () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.settings.pre_validation_alert_percent = '2.5';
    renderPanel({ draft });

    const alert = screen.getByRole('textbox', { name: ALERT });
    expect(alert).toHaveValue('2,5');
    expect(screen.getAllByText(PRE_VALIDATION_ALERT_NOTE).length).toBeGreaterThan(0);
  });

  it('grava o percentual como texto com ponto, e as outras duas configurações junto', async () => {
    simulateApi();
    const { user } = renderPanel();

    const alert = screen.getByRole('textbox', { name: ALERT });
    await user.tripleClick(alert);
    await user.paste('0,75');
    expect(currentDefinition().settings).toMatchObject({ pre_validation_alert_percent: '0.75', error_limit_percent: '5', trace_level: 'standard' });
  });

  it('recusa 3 casas, mais de 100 e negativo: nada vai para o rascunho', async () => {
    simulateApi();
    const { user } = renderPanel();

    const alert = screen.getByRole('textbox', { name: ALERT });
    for (const text of ['1,255', '100,5', '-1', 'abc']) {
      await user.tripleClick(alert);
      await user.paste(text);
      expect(alert).toHaveAccessibleDescription(expect.stringContaining(PERCENT_RULE_MESSAGE));
      expect(currentDefinition().settings.pre_validation_alert_percent).toBe('1');
    }
    await user.tripleClick(alert);
    await user.paste('100');
    expect(currentDefinition().settings.pre_validation_alert_percent).toBe('100');
  });

  it('um rascunho sem o campo mostra o padrão do contrato (1%)', () => {
    simulateApi();
    const draft = exampleDraft();
    Reflect.deleteProperty(draft.definition.settings, 'pre_validation_alert_percent');
    renderPanel({ draft });

    expect(screen.getByRole('textbox', { name: ALERT })).toHaveValue('1');
  });

  it('mostra o problema do campo pelo path', () => {
    simulateApi();
    renderPanel({
      draft: exampleDraft({ problems: [problem('definition_invalid', 'O alerta de campos vazios passa de 100%.', 'settings.pre_validation_alert_percent')] }),
    });

    expect(screen.getByRole('textbox', { name: ALERT })).toHaveAccessibleDescription(expect.stringContaining('O alerta de campos vazios passa de 100%.'));
  });

  it('o problema do campo aparece só nele, não repetido no topo do painel do workflow', () => {
    simulateApi();
    renderPanel({
      draft: exampleDraft({ problems: [problem('definition_invalid', 'O alerta de campos vazios passa de 100%.', 'settings.pre_validation_alert_percent')] }),
    });

    expect(screen.getAllByText('O alerta de campos vazios passa de 100%.')).toHaveLength(1);
  });

  it('só leitura: desabilitado, com o motivo', () => {
    simulateApi();
    renderPanel({ readOnly: true });

    const alert = screen.getByRole('textbox', { name: ALERT });
    expect(alert).toBeDisabled();
    expect(alert).toHaveAccessibleDescription(expect.stringContaining(READ_ONLY_REASON));
  });
});
