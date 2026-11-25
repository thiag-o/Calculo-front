import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKFLOW_ID, json, parameter, renderScreen, savedDraft, simulateApi } from '../api/executions.test-support';
import { TriggerExecutionDialog } from '../trigger';
import { QUERY } from './parameter-form.test-support';

const DRAFT = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
const ALLOWED = `GET /v1/workflows/${WORKFLOW_ID}/parameters/regiao/allowed-values`;
const REGIONS = ['Centro-Oeste', 'Nordeste', 'Norte', 'Sudeste', 'Sul'];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ParameterForm dentro do diálogo Executar lote', () => {
  it('Esc com a lista aberta fecha só a lista; o segundo Esc fecha o diálogo', async () => {
    const api = simulateApi();
    api.respond(DRAFT, json(savedDraft(5, [parameter('regiao', 'text', { allowed_values: QUERY }), parameter('meta', 'text')])));
    api.respond(ALLOWED, json({ values: REGIONS, truncated: false }));
    const onClose = vi.fn();
    const { user } = renderScreen(<TriggerExecutionDialog workflowId={WORKFLOW_ID} onClose={onClose} onTriggered={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });

    // What the user filled: a choice in the search and a text in another field.
    await user.click(await within(dialog).findByRole('textbox', { name: 'meta' }));
    await user.paste('120');
    const field = await within(dialog).findByRole('combobox', { name: 'regiao' });
    await user.click(field);
    await user.click(await screen.findByRole('option', { name: 'Norte' }));
    expect(field).toHaveValue('Norte');

    // The list open again, with something typed.
    await user.click(field);
    await user.keyboard('Su');
    await screen.findByRole('listbox', { name: 'Valores de regiao' });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Executar lote' })).toBeInTheDocument();
    expect(field).toHaveValue('Norte');
    expect(within(dialog).getByRole('textbox', { name: 'meta' })).toHaveValue('120');
    expect(field).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
