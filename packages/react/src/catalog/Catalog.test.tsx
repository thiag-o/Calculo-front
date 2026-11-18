import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Catalog } from '.';
import { problem, renderScreen, simulateApi } from './datasets/datasets.test-support';

afterEach(cleanup);

/** The id the module hands over when the address has a part it cannot decode (`/catalog/<tab>/%zz`). */
const MALFORMED_ID = '%zz';
const ROUTE_ID = '%25zz';

describe('Catálogo: endereço mal formado', () => {
  it.each([
    ['connections', `GET /v1/connections/${ROUTE_ID}`, 'Esta conexão não existe mais neste tenant', 'Voltar para Conexões'],
    ['datasets', `GET /v1/datasets/${ROUTE_ID}`, 'Este dataset não existe mais neste tenant', 'Voltar para datasets'],
    ['files', `GET /v1/excel-files/${ROUTE_ID}`, 'Este arquivo não existe mais neste tenant', 'Voltar para Arquivos'],
  ] as const)('id inválido em %s: mostra "não encontrado" com o caminho de volta, sem derrubar a tela', async (tab, route, message, back) => {
    const api = simulateApi();
    api.respond(route, problem(422, 'invalid_data'));
    api.respond('GET /v1/datasets/%25zz/variables', problem(422, 'invalid_data'));
    const onLocationChange = vi.fn();
    const { user } = renderScreen(<Catalog location={{ tab, id: MALFORMED_ID }} onLocationChange={onLocationChange} />);

    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: back })[0]!);
    expect(onLocationChange).toHaveBeenCalledWith({ tab, id: null });
  });
});
