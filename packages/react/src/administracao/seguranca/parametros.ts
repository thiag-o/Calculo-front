import { z } from 'zod';
import type { AlteracaoConfiguracaoSeguranca, ConfiguracaoSeguranca, ParametroSeguranca } from './consultas';

/** Nome de um parâmetro, como no contrato (`inatividade_minutos`…). */
export type CampoSeguranca = keyof AlteracaoConfiguracaoSeguranca;

/** O que a tela diz de cada parâmetro: rótulo, unidade (plural e singular) e o grupo em que aparece. */
interface DescricaoParametro {
  campo: CampoSeguranca;
  rotulo: string;
  unidade: string;
  unidadeSingular: string;
}

export interface GrupoParametros {
  titulo: string;
  parametros: readonly DescricaoParametro[];
}

/** Os cinco parâmetros, agrupados pelo que controlam, na ordem da tela. */
export const GRUPOS: readonly GrupoParametros[] = [
  {
    titulo: 'Sessão',
    parametros: [
      { campo: 'inatividade_minutos', rotulo: 'Inatividade da sessão', unidade: 'minutos', unidadeSingular: 'minuto' },
      { campo: 'duracao_maxima_dias', rotulo: 'Duração máxima da sessão', unidade: 'dias', unidadeSingular: 'dia' },
    ],
  },
  {
    titulo: 'Senha',
    parametros: [
      { campo: 'senha_minima', rotulo: 'Tamanho mínimo da senha', unidade: 'caracteres', unidadeSingular: 'caractere' },
      { campo: 'validade_link_horas', rotulo: 'Validade do link de redefinição', unidade: 'horas', unidadeSingular: 'hora' },
    ],
  },
  {
    titulo: 'Incorporação',
    parametros: [
      { campo: 'validade_token_minutos', rotulo: 'Validade do token de incorporação', unidade: 'minutos', unidadeSingular: 'minuto' },
    ],
  },
];

export const PARAMETROS: readonly DescricaoParametro[] = GRUPOS.flatMap((grupo) => grupo.parametros);
export const CAMPOS: readonly CampoSeguranca[] = PARAMETROS.map((parametro) => parametro.campo);

/** O formulário guarda o texto digitado; vira número só no envio. */
export type ValoresFormulario = Record<CampoSeguranca, string>;

/** Número no padrão brasileiro (`1.440`). */
export function numero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

/** "480 minutos", "1 dia". */
export function quantidade(valor: number, parametro: DescricaoParametro): string {
  return `${numero(valor)} ${valor === 1 ? parametro.unidadeSingular : parametro.unidade}`;
}

/** Ajuda abaixo do campo: o padrão e os limites aceitos. */
export function ajudaParametro(parametro: ParametroSeguranca): string {
  return `Padrão: ${numero(parametro.padrao)}. Aceita de ${numero(parametro.minimo)} a ${numero(parametro.maximo)}.`;
}

/** O erro de um valor fora dos limites, no mesmo formato da API. */
export function mensagemForaDoLimite(parametro: ParametroSeguranca): string {
  return `Informe um valor de ${numero(parametro.minimo)} a ${numero(parametro.maximo)}.`;
}

export const MENSAGEM_VAZIO = 'Informe um valor.';
export const MENSAGEM_NAO_INTEIRO = 'Informe um número inteiro, sem vírgula nem ponto.';

const INTEIRO = /^-?\d+$/;

/** Os valores em vigor, como texto, para o formulário. */
export function valoresDe(configuracao: ConfiguracaoSeguranca): ValoresFormulario {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, String(configuracao[campo].valor)])) as ValoresFormulario;
}

/** Corpo do PUT a partir de valores já validados. */
export function corpoDe(valores: ValoresFormulario): AlteracaoConfiguracaoSeguranca {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, Number(valores[campo].trim())])) as AlteracaoConfiguracaoSeguranca;
}

/** Os campos cujo valor digitado é diferente do valor em vigor (comparados como número quando possível). */
export function camposAlterados(valores: ValoresFormulario, configuracao: ConfiguracaoSeguranca): CampoSeguranca[] {
  return CAMPOS.filter((campo) => {
    const texto = valores[campo].trim();
    return !(INTEIRO.test(texto) && Number(texto) === configuracao[campo].valor);
  });
}

function campoInteiro(parametro: ParametroSeguranca) {
  return z.string().superRefine((valor, contexto) => {
    const texto = valor.trim();
    if (texto === '') contexto.addIssue({ code: 'custom', message: MENSAGEM_VAZIO });
    else if (!INTEIRO.test(texto)) contexto.addIssue({ code: 'custom', message: MENSAGEM_NAO_INTEIRO });
    else if (Number(texto) < parametro.minimo || Number(texto) > parametro.maximo) {
      contexto.addIssue({ code: 'custom', message: mensagemForaDoLimite(parametro) });
    }
  });
}

/** Validação no cliente, com os limites que a API devolveu (os mesmos que ela confere no PUT). */
export function esquemaDe(configuracao: ConfiguracaoSeguranca) {
  return z.object({
    inatividade_minutos: campoInteiro(configuracao.inatividade_minutos),
    duracao_maxima_dias: campoInteiro(configuracao.duracao_maxima_dias),
    senha_minima: campoInteiro(configuracao.senha_minima),
    validade_link_horas: campoInteiro(configuracao.validade_link_horas),
    validade_token_minutos: campoInteiro(configuracao.validade_token_minutos),
  });
}
