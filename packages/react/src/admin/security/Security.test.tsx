import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OUT_OF_RANGE_MESSAGE, NO_PERMISSION_MESSAGE } from './messages';
import { NOT_INTEGER_MESSAGE, EMPTY_MESSAGE } from './parameters';
import { SAVED_MESSAGE, ALREADY_DEFAULT_REASON, NO_CHANGES_REASON, SYSTEM_NOTE } from './Security';
import {
  ADJUSTED,
  DEFAULTS,
  withValues,
  setCsrfCookie,
  json,
  problem,
  renderSecurity,
  pendingResponse,
  simulateApi,
  type SimulatedApi,
  type SecurityScreen,
} from './security.test-support';

const GET_ROUTE = 'GET /v1/configuracoes/seguranca';
const PUT_ROUTE = 'PUT /v1/configuracoes/seguranca';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// `hidden`: with the confirmation open, Radix hides the rest of the screen from the screen reader.
const field = (name: RegExp | string) => screen.getByRole('textbox', { name, hidden: true });
const inactivity = () => field('Inatividade da sessão (minutos)');
const duration = () => field('Duração máxima da sessão (dias)');
const password = () => field('Tamanho mínimo da senha (caracteres)');
const link = () => field('Validade do link de redefinição (horas)');
const token = () => field('Validade do token de incorporação (minutos)');
const save = () => screen.getByRole('button', { name: 'Salvar' });
const resetButton = (label: string) => screen.getByRole('button', { name: `Voltar ao padrão: ${label}` });

async function load(settings = DEFAULTS): Promise<SecurityScreen> {
  api.respond(GET_ROUTE, json(settings));
  const view = renderSecurity();
  await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' });
  return view;
}

async function replaceValue(user: SecurityScreen['user'], input: HTMLElement, value: string) {
  await user.clear(input);
  if (value !== '') await user.type(input, value);
}

describe('Segurança: carregar', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json(DEFAULTS));
    api.respond(GET_ROUTE, pending.promise);
    renderSecurity();

    expect(screen.getByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando os parâmetros de segurança');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    pending.release();
    expect(await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' })).toBeInTheDocument();
    expect(screen.queryByText('Carregando os parâmetros de segurança')).not.toBeInTheDocument();
  });

  it('mostra os cinco parâmetros, agrupados, com o valor em vigor, o padrão e os limites', async () => {
    await load(ADJUSTED);

    expect(screen.getByRole('group', { name: 'Sessão' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Senha' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Incorporação' })).toBeInTheDocument();

    expect(inactivity()).toHaveValue('60');
    expect(inactivity()).toHaveAccessibleDescription('Padrão: 480. Aceita de 15 a 1.440.');
    expect(duration()).toHaveValue('7');
    expect(duration()).toHaveAccessibleDescription('Padrão: 7. Aceita de 1 a 30.');
    expect(password()).toHaveValue('16');
    expect(password()).toHaveAccessibleDescription('Padrão: 12. Aceita de 8 a 64.');
    expect(link()).toHaveValue('24');
    expect(link()).toHaveAccessibleDescription('Padrão: 24. Aceita de 1 a 72.');
    expect(token()).toHaveValue('15');
    expect(token()).toHaveAccessibleDescription('Padrão: 15. Aceita de 5 a 60.');
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });

  it('avisa que o bloqueio de login e o limite por IP são do sistema, não do tenant', async () => {
    await load();
    expect(screen.getByText(SYSTEM_NOTE)).toBeInTheDocument();
    expect(SYSTEM_NOTE).toMatch(/bloqueio de login/);
    expect(SYSTEM_NOTE).toMatch(/limite de tentativas por IP/);
  });

  it('mostra o erro com "Tentar de novo" e carrega de novo', async () => {
    api.respond(GET_ROUTE, problem(503, 'unavailable'), json(DEFAULTS));
    const { user } = renderSecurity();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os parâmetros de segurança');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');
    // The system note stays visible on error.
    expect(screen.getByText(SYSTEM_NOTE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' })).toHaveValue('480');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sem permissão, explica e não oferece tentar de novo', async () => {
    api.respond(GET_ROUTE, problem(403, 'sem_permissao'));
    renderSecurity();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sem conexão, diz o que houve', async () => {
    api.respond(GET_ROUTE, () => Promise.reject(new TypeError('Failed to fetch')));
    renderSecurity();
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique a conexão');
  });
});

describe('Segurança: editar', () => {
  it('"Salvar" fica desabilitado, com o motivo ao lado, enquanto nada muda', async () => {
    const { user } = await load();

    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(save()).toHaveAccessibleDescription(NO_CHANGES_REASON);
    expect(screen.getByText(NO_CHANGES_REASON)).toBeVisible();

    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await replaceValue(user, inactivity(), '240');
    expect(save()).not.toHaveAttribute('aria-disabled');

    // Going back to the value in force undoes the change.
    await replaceValue(user, inactivity(), '480');
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('"Voltar ao padrão" põe o padrão no campo, sem salvar, e fica desabilitado quando já está nele', async () => {
    const { user } = await load(ADJUSTED);

    const resetInactivity = resetButton('Inatividade da sessão');
    expect(resetInactivity).not.toHaveAttribute('aria-disabled');
    expect(resetButton('Duração máxima da sessão')).toHaveAttribute('aria-disabled', 'true');
    expect(resetButton('Duração máxima da sessão')).toHaveAccessibleDescription(ALREADY_DEFAULT_REASON);

    await user.click(resetInactivity);
    expect(inactivity()).toHaveValue('480');
    expect(resetButton('Inatividade da sessão')).toHaveAttribute('aria-disabled', 'true');
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
    // Changed from the value in force (60): it can be saved.
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('"Voltar ao padrão" também limpa o erro do campo', async () => {
    const { user } = await load();
    await replaceValue(user, password(), '4');
    await user.click(save());
    expect(password()).toHaveAccessibleDescription(/Informe um valor de 8 a 64\./);

    await user.click(resetButton('Tamanho mínimo da senha'));
    expect(password()).toHaveValue('12');
    expect(password()).not.toHaveAttribute('aria-invalid');
  });
});

describe('Segurança: validação no cliente', () => {
  it.each([
    ['abaixo do mínimo', '14', 'Informe um valor de 15 a 1.440.'],
    ['acima do máximo', '1441', 'Informe um valor de 15 a 1.440.'],
    ['negativo', '-5', 'Informe um valor de 15 a 1.440.'],
    ['vazio', '', EMPTY_MESSAGE],
    ['com vírgula', '30,5', NOT_INTEGER_MESSAGE],
    ['com letras', 'trinta', NOT_INTEGER_MESSAGE],
  ])('recusa valor %s, no campo, sem chamar a API', async (_case, value, message) => {
    const { user } = await load();
    await replaceValue(user, inactivity(), value);
    await user.click(save());

    expect(inactivity()).toHaveAttribute('aria-invalid', 'true');
    expect(inactivity()).toHaveAccessibleDescription(`${message} Padrão: 480. Aceita de 15 a 1.440.`);
    expect(inactivity()).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it.each([
    ['o mínimo', '15'],
    ['o máximo', '1440'],
  ])('aceita %s exato', async (_case, value) => {
    const { user } = await load();
    await replaceValue(user, inactivity(), value);
    await user.click(save());

    expect(await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toBeInTheDocument();
    expect(inactivity()).not.toHaveAttribute('aria-invalid');
  });

  it('usa os limites de cada parâmetro, vindos da API', async () => {
    const { user } = await load();
    await replaceValue(user, duration(), '31');
    await replaceValue(user, password(), '7');
    await replaceValue(user, link(), '0');
    await replaceValue(user, token(), '61');
    await user.click(save());

    expect(duration()).toHaveAccessibleDescription(/^Informe um valor de 1 a 30\./);
    expect(password()).toHaveAccessibleDescription(/^Informe um valor de 8 a 64\./);
    expect(link()).toHaveAccessibleDescription(/^Informe um valor de 1 a 72\./);
    expect(token()).toHaveAccessibleDescription(/^Informe um valor de 5 a 60\./);
    expect(inactivity()).not.toHaveAttribute('aria-invalid');
    // Focus goes to the first field with an error.
    expect(duration()).toHaveFocus();
  });

  it('depois do primeiro envio, o erro some assim que o valor fica válido', async () => {
    const { user } = await load();
    await replaceValue(user, token(), '90');
    await user.click(save());
    expect(token()).toHaveAttribute('aria-invalid', 'true');

    await replaceValue(user, token(), '30');
    expect(token()).not.toHaveAttribute('aria-invalid');
  });
});

describe('Segurança: salvar com confirmação', () => {
  it('confirma mostrando só o que mudou, envia os cinco valores e avisa que salvou', async () => {
    setCsrfCookie('csrf-123');
    const saved = withValues(DEFAULTS, { inatividade_minutos: 240, validade_link_horas: 1 });
    api.respond(PUT_ROUTE, json(saved));
    const { user } = await load();

    await replaceValue(user, inactivity(), '240');
    await replaceValue(user, link(), ' 1 ');
    await user.click(save());

    const dialog = await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' });
    expect(dialog).toHaveAccessibleDescription(/valem para todo o tenant/);
    const items = within(within(dialog).getByRole('list', { name: 'Parâmetros alterados' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Inatividade da sessãode 480 minutos para 240 minutos',
      'Validade do link de redefiniçãode 24 horas para 1 hora',
    ]);
    // Nada foi enviado ainda.
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [call] = api.callsTo(PUT_ROUTE);
    expect(call).toBeDefined();
    expect(await call!.json()).toEqual({
      inatividade_minutos: 240,
      duracao_maxima_dias: 7,
      senha_minima: 12,
      validade_link_horas: 1,
      validade_token_minutos: 15,
    });
    expect(call!.headers.get('X-CSRF-Token')).toBe('csrf-123');

    expect(await screen.findByRole('status')).toHaveTextContent(SAVED_MESSAGE);
    expect(inactivity()).toHaveValue('240');
    expect(link()).toHaveValue('1');
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(save()).toHaveFocus());
    // The PUT response updates the cache: no refetch.
    expect(api.callsTo(GET_ROUTE)).toHaveLength(1);
  });

  it('o aviso de salvo some quando o formulário muda de novo', async () => {
    api.respond(PUT_ROUTE, json(withValues(DEFAULTS, { senha_minima: 20 })));
    const { user } = await load();
    await replaceValue(user, password(), '20');
    await user.click(save());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument();

    await replaceValue(user, password(), '21');
    expect(screen.queryByText(SAVED_MESSAGE)).not.toBeInTheDocument();
  });

  it('"Cancelar" fecha sem salvar, mantém o que foi digitado e devolve o foco ao "Salvar"', async () => {
    const { user } = await load();
    await replaceValue(user, token(), '30');
    await user.click(save());

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
    expect(token()).toHaveValue('30');
    await waitFor(() => expect(save()).toHaveFocus());
  });

  it('Esc fecha a confirmação sem salvar', async () => {
    const { user } = await load();
    await replaceValue(user, token(), '30');
    await user.click(save());
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('Enter num campo também envia para a confirmação', async () => {
    const { user } = await load();
    await replaceValue(user, duration(), '14{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toHaveTextContent('de 7 dias para 14 dias');
  });

  it('mostra o envio em andamento no botão da confirmação', async () => {
    const pending = pendingResponse(() => json(withValues(DEFAULTS, { duracao_maxima_dias: 1 })));
    api.respond(PUT_ROUTE, pending.promise);
    const { user } = await load();
    await replaceValue(user, duration(), '1');
    await user.click(save());

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('de 7 dias para 1 dia');
    const confirm = within(dialog).getByRole('button', { name: 'Salvar' });
    await user.click(confirm);
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    // A second click while submitting does not send another request.
    await user.click(confirm);
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);

    pending.release();
    expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument();
  });
});

describe('Segurança: erros ao salvar', () => {
  it('valor_fora_do_limite: mostra o erro da API em cada campo, foca o primeiro e busca os limites de novo', async () => {
    api.respond(
      PUT_ROUTE,
      problem(422, 'valor_fora_do_limite', {
        campos: {
          inatividade_minutos: 'Informe um valor de 15 a 720.',
          senha_minima: 'Informe um valor de 10 a 64.',
        },
      }),
    );
    // The next GET brings the updated bounds.
    const newBounds = {
      ...DEFAULTS,
      inatividade_minutos: { ...DEFAULTS.inatividade_minutos, maximo: 720 },
      senha_minima: { ...DEFAULTS.senha_minima, minimo: 10 },
    };
    api.respond(GET_ROUTE, json(DEFAULTS), json(newBounds));
    const { user } = renderSecurity();
    await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' });

    await replaceValue(user, inactivity(), '1000');
    await replaceValue(user, password(), '9');
    await user.click(save());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(inactivity()).toHaveAttribute('aria-invalid', 'true'));
    expect(inactivity()).toHaveAccessibleDescription(/^Informe um valor de 15 a 720\./);
    expect(password()).toHaveAttribute('aria-invalid', 'true');
    expect(password()).toHaveAccessibleDescription(/^Informe um valor de 10 a 64\./);
    expect(duration()).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(inactivity()).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(OUT_OF_RANGE_MESSAGE);
    // Nothing was saved: what the person typed is still there.
    expect(inactivity()).toHaveValue('1000');

    // The bounds were fetched again and the help shows the new ones.
    await waitFor(() => expect(api.callsTo(GET_ROUTE)).toHaveLength(2));
    await waitFor(() => expect(inactivity()).toHaveAccessibleDescription(/Aceita de 15 a 720\.$/));

    // Once fixed, the field error goes away and the client validator already uses the new bound.
    await replaceValue(user, inactivity(), '721');
    expect(inactivity()).toHaveAccessibleDescription(/^Informe um valor de 15 a 720\./);
    await replaceValue(user, inactivity(), '720');
    expect(inactivity()).not.toHaveAttribute('aria-invalid');
  });

  it('dados_invalidos com campos: mostra no campo', async () => {
    api.respond(PUT_ROUTE, problem(422, 'dados_invalidos', { campos: { validade_token_minutos: 'Informe um número inteiro.' } }));
    const { user } = await load();
    await replaceValue(user, token(), '20');
    await user.click(save());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(token()).toHaveAttribute('aria-invalid', 'true'));
    expect(token()).toHaveAccessibleDescription(/^Informe um número inteiro\./);
    expect(screen.getByRole('alert')).toHaveTextContent('Nada foi salvo.');
  });

  it.each([
    ['sem_permissao', 403, NO_PERMISSION_MESSAGE],
    ['csrf_invalido', 403, 'Texto do servidor para csrf_invalido.'],
    ['unavailable', 503, 'Texto do servidor para unavailable.'],
  ])('%s: o erro fica na confirmação, que continua aberta para tentar de novo', async (code, status, message) => {
    api.respond(PUT_ROUTE, problem(status, code), json(withValues(DEFAULTS, { validade_token_minutos: 30 })));
    const { user } = await load();
    await replaceValue(user, token(), '30');
    await user.click(save());

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(token()).not.toHaveAttribute('aria-invalid');

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument();
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(2);
  });

  it('abrir a confirmação de novo começa sem o erro anterior', async () => {
    api.respond(PUT_ROUTE, problem(503, 'unavailable'));
    const { user } = await load();
    await replaceValue(user, token(), '30');
    await user.click(save());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(save());
    const other = await screen.findByRole('dialog');
    expect(within(other).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Segurança: atualização em segundo plano', () => {
  it('valores novos do servidor entram nos campos não editados e preservam o que a pessoa digitou', async () => {
    const { user, queryClient } = await load();
    await replaceValue(user, token(), '30');

    api.respond(GET_ROUTE, json(withValues(DEFAULTS, { senha_minima: 14, validade_token_minutos: 20 })));
    await queryClient.refetchQueries({ queryKey: ['admin', 'security'] });

    await waitFor(() => expect(password()).toHaveValue('14'));
    expect(token()).toHaveValue('30');
  });

  it('erro ao atualizar com dados na tela: mantém o formulário e oferece "Tentar de novo"', async () => {
    const { user, queryClient } = await load();
    api.respond(GET_ROUTE, problem(503, 'unavailable'), json(DEFAULTS));
    await queryClient.refetchQueries({ queryKey: ['admin', 'security'] });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível atualizar os parâmetros');
    expect(inactivity()).toHaveValue('480');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
