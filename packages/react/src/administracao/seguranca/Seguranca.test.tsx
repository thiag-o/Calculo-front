import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_FORA_DO_LIMITE, MENSAGEM_SEM_PERMISSAO } from './mensagens';
import { MENSAGEM_NAO_INTEIRO, MENSAGEM_VAZIO } from './parametros';
import { MENSAGEM_SALVO, MOTIVO_JA_NO_PADRAO, MOTIVO_SEM_ALTERACAO, NOTA_SISTEMA } from './Seguranca';
import {
  AJUSTADA,
  PADROES,
  comValores,
  definirCookieCsrf,
  json,
  problema,
  renderizarSeguranca,
  respostaPendente,
  simularApi,
  type ApiSimulada,
  type TelaSeguranca,
} from './seguranca.test.apoio';

const ROTA_GET = 'GET /v1/configuracoes/seguranca';
const ROTA_PUT = 'PUT /v1/configuracoes/seguranca';

let api: ApiSimulada;

beforeEach(() => {
  api = simularApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// `hidden`: com a confirmação aberta, o Radix esconde o resto da tela do leitor de tela.
const campo = (nome: RegExp | string) => screen.getByRole('textbox', { name: nome, hidden: true });
const inatividade = () => campo('Inatividade da sessão (minutos)');
const duracao = () => campo('Duração máxima da sessão (dias)');
const senha = () => campo('Tamanho mínimo da senha (caracteres)');
const link = () => campo('Validade do link de redefinição (horas)');
const token = () => campo('Validade do token de incorporação (minutos)');
const salvar = () => screen.getByRole('button', { name: 'Salvar' });
const voltar = (rotulo: string) => screen.getByRole('button', { name: `Voltar ao padrão: ${rotulo}` });

async function carregar(configuracao = PADROES): Promise<TelaSeguranca> {
  api.responder(ROTA_GET, json(configuracao));
  const tela = renderizarSeguranca();
  await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' });
  return tela;
}

async function trocar(usuario: TelaSeguranca['usuario'], entrada: HTMLElement, valor: string) {
  await usuario.clear(entrada);
  if (valor !== '') await usuario.type(entrada, valor);
}

describe('Segurança: carregar', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pendente = respostaPendente(() => json(PADROES));
    api.responder(ROTA_GET, pendente.promessa);
    renderizarSeguranca();

    expect(screen.getByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando os parâmetros de segurança');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    pendente.liberar();
    expect(await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' })).toBeInTheDocument();
    expect(screen.queryByText('Carregando os parâmetros de segurança')).not.toBeInTheDocument();
  });

  it('mostra os cinco parâmetros, agrupados, com o valor em vigor, o padrão e os limites', async () => {
    await carregar(AJUSTADA);

    expect(screen.getByRole('group', { name: 'Sessão' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Senha' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Incorporação' })).toBeInTheDocument();

    expect(inatividade()).toHaveValue('60');
    expect(inatividade()).toHaveAccessibleDescription('Padrão: 480. Aceita de 15 a 1.440.');
    expect(duracao()).toHaveValue('7');
    expect(duracao()).toHaveAccessibleDescription('Padrão: 7. Aceita de 1 a 30.');
    expect(senha()).toHaveValue('16');
    expect(senha()).toHaveAccessibleDescription('Padrão: 12. Aceita de 8 a 64.');
    expect(link()).toHaveValue('24');
    expect(link()).toHaveAccessibleDescription('Padrão: 24. Aceita de 1 a 72.');
    expect(token()).toHaveValue('15');
    expect(token()).toHaveAccessibleDescription('Padrão: 15. Aceita de 5 a 60.');
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });

  it('avisa que o bloqueio de login e o limite por IP são do sistema, não do tenant', async () => {
    await carregar();
    expect(screen.getByText(NOTA_SISTEMA)).toBeInTheDocument();
    expect(NOTA_SISTEMA).toMatch(/bloqueio de login/);
    expect(NOTA_SISTEMA).toMatch(/limite de tentativas por IP/);
  });

  it('mostra o erro com "Tentar de novo" e carrega de novo', async () => {
    api.responder(ROTA_GET, problema(503, 'indisponivel'), json(PADROES));
    const { usuario } = renderizarSeguranca();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os parâmetros de segurança');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');
    // A nota do sistema continua visível no erro.
    expect(screen.getByText(NOTA_SISTEMA)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' })).toHaveValue('480');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sem permissão, explica e não oferece tentar de novo', async () => {
    api.responder(ROTA_GET, problema(403, 'sem_permissao'));
    renderizarSeguranca();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sem conexão, diz o que houve', async () => {
    api.responder(ROTA_GET, () => Promise.reject(new TypeError('Failed to fetch')));
    renderizarSeguranca();
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique a conexão');
  });
});

describe('Segurança: editar', () => {
  it('"Salvar" fica desabilitado, com o motivo ao lado, enquanto nada muda', async () => {
    const { usuario } = await carregar();

    expect(salvar()).toHaveAttribute('aria-disabled', 'true');
    expect(salvar()).toHaveAccessibleDescription(MOTIVO_SEM_ALTERACAO);
    expect(screen.getByText(MOTIVO_SEM_ALTERACAO)).toBeVisible();

    await usuario.click(salvar());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await trocar(usuario, inatividade(), '240');
    expect(salvar()).not.toHaveAttribute('aria-disabled');

    // Voltar ao valor em vigor desfaz a alteração.
    await trocar(usuario, inatividade(), '480');
    expect(salvar()).toHaveAttribute('aria-disabled', 'true');
  });

  it('"Voltar ao padrão" põe o padrão no campo, sem salvar, e fica desabilitado quando já está nele', async () => {
    const { usuario } = await carregar(AJUSTADA);

    const voltarInatividade = voltar('Inatividade da sessão');
    expect(voltarInatividade).not.toHaveAttribute('aria-disabled');
    expect(voltar('Duração máxima da sessão')).toHaveAttribute('aria-disabled', 'true');
    expect(voltar('Duração máxima da sessão')).toHaveAccessibleDescription(MOTIVO_JA_NO_PADRAO);

    await usuario.click(voltarInatividade);
    expect(inatividade()).toHaveValue('480');
    expect(voltar('Inatividade da sessão')).toHaveAttribute('aria-disabled', 'true');
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(0);
    // Mudou em relação ao valor em vigor (60): dá para salvar.
    expect(salvar()).not.toHaveAttribute('aria-disabled');
  });

  it('"Voltar ao padrão" também limpa o erro do campo', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, senha(), '4');
    await usuario.click(salvar());
    expect(senha()).toHaveAccessibleDescription(/Informe um valor de 8 a 64\./);

    await usuario.click(voltar('Tamanho mínimo da senha'));
    expect(senha()).toHaveValue('12');
    expect(senha()).not.toHaveAttribute('aria-invalid');
  });
});

describe('Segurança: validação no cliente', () => {
  it.each([
    ['abaixo do mínimo', '14', 'Informe um valor de 15 a 1.440.'],
    ['acima do máximo', '1441', 'Informe um valor de 15 a 1.440.'],
    ['negativo', '-5', 'Informe um valor de 15 a 1.440.'],
    ['vazio', '', MENSAGEM_VAZIO],
    ['com vírgula', '30,5', MENSAGEM_NAO_INTEIRO],
    ['com letras', 'trinta', MENSAGEM_NAO_INTEIRO],
  ])('recusa valor %s, no campo, sem chamar a API', async (_caso, valor, mensagem) => {
    const { usuario } = await carregar();
    await trocar(usuario, inatividade(), valor);
    await usuario.click(salvar());

    expect(inatividade()).toHaveAttribute('aria-invalid', 'true');
    expect(inatividade()).toHaveAccessibleDescription(`${mensagem} Padrão: 480. Aceita de 15 a 1.440.`);
    expect(inatividade()).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(0);
  });

  it.each([
    ['o mínimo', '15'],
    ['o máximo', '1440'],
  ])('aceita %s exato', async (_caso, valor) => {
    const { usuario } = await carregar();
    await trocar(usuario, inatividade(), valor);
    await usuario.click(salvar());

    expect(await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toBeInTheDocument();
    expect(inatividade()).not.toHaveAttribute('aria-invalid');
  });

  it('usa os limites de cada parâmetro, vindos da API', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, duracao(), '31');
    await trocar(usuario, senha(), '7');
    await trocar(usuario, link(), '0');
    await trocar(usuario, token(), '61');
    await usuario.click(salvar());

    expect(duracao()).toHaveAccessibleDescription(/^Informe um valor de 1 a 30\./);
    expect(senha()).toHaveAccessibleDescription(/^Informe um valor de 8 a 64\./);
    expect(link()).toHaveAccessibleDescription(/^Informe um valor de 1 a 72\./);
    expect(token()).toHaveAccessibleDescription(/^Informe um valor de 5 a 60\./);
    expect(inatividade()).not.toHaveAttribute('aria-invalid');
    // O foco vai para o primeiro campo com erro.
    expect(duracao()).toHaveFocus();
  });

  it('depois do primeiro envio, o erro some assim que o valor fica válido', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, token(), '90');
    await usuario.click(salvar());
    expect(token()).toHaveAttribute('aria-invalid', 'true');

    await trocar(usuario, token(), '30');
    expect(token()).not.toHaveAttribute('aria-invalid');
  });
});

describe('Segurança: salvar com confirmação', () => {
  it('confirma mostrando só o que mudou, envia os cinco valores e avisa que salvou', async () => {
    definirCookieCsrf('csrf-123');
    const salvos = comValores(PADROES, { inatividade_minutos: 240, validade_link_horas: 1 });
    api.responder(ROTA_PUT, json(salvos));
    const { usuario } = await carregar();

    await trocar(usuario, inatividade(), '240');
    await trocar(usuario, link(), ' 1 ');
    await usuario.click(salvar());

    const dialogo = await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' });
    expect(dialogo).toHaveAccessibleDescription(/valem para todo o tenant/);
    const itens = within(within(dialogo).getByRole('list', { name: 'Parâmetros alterados' })).getAllByRole('listitem');
    expect(itens.map((item) => item.textContent)).toEqual([
      'Inatividade da sessãode 480 minutos para 240 minutos',
      'Validade do link de redefiniçãode 24 horas para 1 hora',
    ]);
    // Nada foi enviado ainda.
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(0);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [chamada] = api.chamadasDe(ROTA_PUT);
    expect(chamada).toBeDefined();
    expect(await chamada!.json()).toEqual({
      inatividade_minutos: 240,
      duracao_maxima_dias: 7,
      senha_minima: 12,
      validade_link_horas: 1,
      validade_token_minutos: 15,
    });
    expect(chamada!.headers.get('X-CSRF-Token')).toBe('csrf-123');

    expect(await screen.findByRole('status')).toHaveTextContent(MENSAGEM_SALVO);
    expect(inatividade()).toHaveValue('240');
    expect(link()).toHaveValue('1');
    expect(salvar()).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(salvar()).toHaveFocus());
    // A resposta do PUT atualiza o cache: nada de buscar de novo.
    expect(api.chamadasDe(ROTA_GET)).toHaveLength(1);
  });

  it('o aviso de salvo some quando o formulário muda de novo', async () => {
    api.responder(ROTA_PUT, json(comValores(PADROES, { senha_minima: 20 })));
    const { usuario } = await carregar();
    await trocar(usuario, senha(), '20');
    await usuario.click(salvar());
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(MENSAGEM_SALVO)).toBeInTheDocument();

    await trocar(usuario, senha(), '21');
    expect(screen.queryByText(MENSAGEM_SALVO)).not.toBeInTheDocument();
  });

  it('"Cancelar" fecha sem salvar, mantém o que foi digitado e devolve o foco ao "Salvar"', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, token(), '30');
    await usuario.click(salvar());

    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(0);
    expect(token()).toHaveValue('30');
    await waitFor(() => expect(salvar()).toHaveFocus());
  });

  it('Esc fecha a confirmação sem salvar', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, token(), '30');
    await usuario.click(salvar());
    await screen.findByRole('dialog');

    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(0);
  });

  it('Enter num campo também envia para a confirmação', async () => {
    const { usuario } = await carregar();
    await trocar(usuario, duracao(), '14{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toHaveTextContent('de 7 dias para 14 dias');
  });

  it('mostra o envio em andamento no botão da confirmação', async () => {
    const pendente = respostaPendente(() => json(comValores(PADROES, { duracao_maxima_dias: 1 })));
    api.responder(ROTA_PUT, pendente.promessa);
    const { usuario } = await carregar();
    await trocar(usuario, duracao(), '1');
    await usuario.click(salvar());

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('de 7 dias para 1 dia');
    const confirmar = within(dialogo).getByRole('button', { name: 'Salvar' });
    await usuario.click(confirmar);
    expect(confirmar).toHaveAttribute('aria-busy', 'true');
    // Um segundo clique durante o envio não manda outra requisição.
    await usuario.click(confirmar);
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(1);

    pendente.liberar();
    expect(await screen.findByText(MENSAGEM_SALVO)).toBeInTheDocument();
  });
});

describe('Segurança: erros ao salvar', () => {
  it('valor_fora_do_limite: mostra o erro da API em cada campo, foca o primeiro e busca os limites de novo', async () => {
    api.responder(
      ROTA_PUT,
      problema(422, 'valor_fora_do_limite', {
        campos: {
          inatividade_minutos: 'Informe um valor de 15 a 720.',
          senha_minima: 'Informe um valor de 10 a 64.',
        },
      }),
    );
    // O GET seguinte traz os limites atualizados.
    const limitesNovos = {
      ...PADROES,
      inatividade_minutos: { ...PADROES.inatividade_minutos, maximo: 720 },
      senha_minima: { ...PADROES.senha_minima, minimo: 10 },
    };
    api.responder(ROTA_GET, json(PADROES), json(limitesNovos));
    const { usuario } = renderizarSeguranca();
    await screen.findByRole('textbox', { name: 'Inatividade da sessão (minutos)' });

    await trocar(usuario, inatividade(), '1000');
    await trocar(usuario, senha(), '9');
    await usuario.click(salvar());
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(inatividade()).toHaveAttribute('aria-invalid', 'true'));
    expect(inatividade()).toHaveAccessibleDescription(/^Informe um valor de 15 a 720\./);
    expect(senha()).toHaveAttribute('aria-invalid', 'true');
    expect(senha()).toHaveAccessibleDescription(/^Informe um valor de 10 a 64\./);
    expect(duracao()).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(inatividade()).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_FORA_DO_LIMITE);
    // Nada foi gravado: o que a pessoa digitou continua lá.
    expect(inatividade()).toHaveValue('1000');

    // Os limites foram buscados de novo e a ajuda mostra os novos.
    await waitFor(() => expect(api.chamadasDe(ROTA_GET)).toHaveLength(2));
    await waitFor(() => expect(inatividade()).toHaveAccessibleDescription(/Aceita de 15 a 720\.$/));

    // Corrigido, o erro do campo some e o validador do cliente já usa o limite novo.
    await trocar(usuario, inatividade(), '721');
    expect(inatividade()).toHaveAccessibleDescription(/^Informe um valor de 15 a 720\./);
    await trocar(usuario, inatividade(), '720');
    expect(inatividade()).not.toHaveAttribute('aria-invalid');
  });

  it('dados_invalidos com campos: mostra no campo', async () => {
    api.responder(ROTA_PUT, problema(422, 'dados_invalidos', { campos: { validade_token_minutos: 'Informe um número inteiro.' } }));
    const { usuario } = await carregar();
    await trocar(usuario, token(), '20');
    await usuario.click(salvar());
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(token()).toHaveAttribute('aria-invalid', 'true'));
    expect(token()).toHaveAccessibleDescription(/^Informe um número inteiro\./);
    expect(screen.getByRole('alert')).toHaveTextContent('Nada foi salvo.');
  });

  it.each([
    ['sem_permissao', 403, MENSAGEM_SEM_PERMISSAO],
    ['csrf_invalido', 403, 'Texto do servidor para csrf_invalido.'],
    ['indisponivel', 503, 'Texto do servidor para indisponivel.'],
  ])('%s: o erro fica na confirmação, que continua aberta para tentar de novo', async (codigo, status, mensagem) => {
    api.responder(ROTA_PUT, problema(status, codigo), json(comValores(PADROES, { validade_token_minutos: 30 })));
    const { usuario } = await carregar();
    await trocar(usuario, token(), '30');
    await usuario.click(salvar());

    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem);
    expect(token()).not.toHaveAttribute('aria-invalid');

    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(MENSAGEM_SALVO)).toBeInTheDocument();
    expect(api.chamadasDe(ROTA_PUT)).toHaveLength(2);
  });

  it('abrir a confirmação de novo começa sem o erro anterior', async () => {
    api.responder(ROTA_PUT, problema(503, 'indisponivel'));
    const { usuario } = await carregar();
    await trocar(usuario, token(), '30');
    await usuario.click(salvar());
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await within(dialogo).findByRole('alert');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await usuario.click(salvar());
    const outro = await screen.findByRole('dialog');
    expect(within(outro).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Segurança: atualização em segundo plano', () => {
  it('valores novos do servidor entram nos campos não editados e preservam o que a pessoa digitou', async () => {
    const { usuario, queryClient } = await carregar();
    await trocar(usuario, token(), '30');

    api.responder(ROTA_GET, json(comValores(PADROES, { senha_minima: 14, validade_token_minutos: 20 })));
    await queryClient.refetchQueries({ queryKey: ['administracao', 'seguranca'] });

    await waitFor(() => expect(senha()).toHaveValue('14'));
    expect(token()).toHaveValue('30');
  });

  it('erro ao atualizar com dados na tela: mantém o formulário e oferece "Tentar de novo"', async () => {
    const { usuario, queryClient } = await carregar();
    api.responder(ROTA_GET, problema(503, 'indisponivel'), json(PADROES));
    await queryClient.refetchQueries({ queryKey: ['administracao', 'seguranca'] });

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível atualizar os parâmetros');
    expect(inatividade()).toHaveValue('480');

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
