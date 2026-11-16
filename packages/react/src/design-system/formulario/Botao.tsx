import { forwardRef, useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { classesTexto } from '../tipografia';
import { DicaBotao } from './DicaBotao';
import { IconeCarregando, IconeInfo } from './icones';
import './botao.css';

/** Variantes do estilos.md §7.1. Uma ação principal por área. */
export type VarianteBotao = 'principal' | 'secundario' | 'fantasma' | 'perigo';

/** 28px (pequeno), 32px (padrão) e 40px (grande). */
export type TamanhoBotao = 'pequeno' | 'padrao' | 'grande';

/** Onde o motivo de um botão desabilitado aparece: na dica (foco e hover) ou em texto ao lado. */
export type ExibicaoMotivo = 'dica' | 'ao-lado';

interface BotaoBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children'> {
  /** Padrão: `secundario`. */
  variante?: VarianteBotao;
  /** Padrão: `padrao` (32px). */
  tamanho?: TamanhoBotao;
  /** Ícone à esquerda do texto (16px; 14px no pequeno), como um ícone Lucide. */
  icone?: ReactNode;
  /** Ação em andamento: mostra o indicador, marca `aria-busy` e ignora cliques, sem perder o foco. */
  carregando?: boolean;
  /**
   * Desabilita o botão dizendo o porquê (estilos.md §14): "Resolva 1 problema e 1 teste para enviar".
   * Não há botão desabilitado sem motivo. O botão continua focável, com `aria-disabled` e o motivo em `aria-describedby`.
   */
  motivoDesabilitado?: string;
  /** Padrão: `dica`. */
  exibirMotivo?: ExibicaoMotivo;
}

interface BotaoComTextoProps extends BotaoBaseProps {
  soIcone?: false;
  /** Texto no formato verbo + objeto ("Abrir editor"). */
  children: ReactNode;
  rotulo?: never;
}

interface BotaoSoIconeProps extends BotaoBaseProps {
  /** Botão quadrado só com o ícone. */
  soIcone: true;
  icone: ReactNode;
  /** Nome acessível do botão, mostrado também na dica. */
  rotulo: string;
  children?: never;
}

export type BotaoProps = BotaoComTextoProps | BotaoSoIconeProps;

interface BotaoNativoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** O aria-describedby do botão. */
  descricao?: string;
}

/**
 * O `<button>`, com o aria-describedby vindo só de `descricao`. A dica (Radix Tooltip) acrescenta o id do
 * próprio conteúdo ao aria-describedby enquanto está aberta; como o Botao já descreve o motivo, o leitor de tela
 * o leria duas vezes. Por isso o aria-describedby que chega da dica é descartado.
 */
const BotaoNativo = forwardRef<HTMLButtonElement, BotaoNativoProps>(function BotaoNativo(
  { descricao, ...resto },
  ref,
) {
  // O aria-describedby de `resto` (o da dica) é sobrescrito.
  return <button {...resto} ref={ref} aria-describedby={descricao} />;
});

/** Botão do produto (estilos.md §7.1): variantes, tamanhos, só ícone, carregando e desabilitado com motivo. */
export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(props, ref) {
  const {
    variante = 'secundario',
    tamanho = 'padrao',
    icone,
    carregando = false,
    motivoDesabilitado,
    exibirMotivo = 'dica',
    soIcone = false,
    rotulo,
    children,
    className,
    type = 'button',
    onClick,
    'aria-describedby': descritoPorExterno,
    ...resto
  } = props;

  const idMotivo = useId();
  const desabilitado = Boolean(motivoDesabilitado);
  const inerte = desabilitado || carregando;
  const descritoPor = [desabilitado ? idMotivo : undefined, descritoPorExterno].filter(Boolean).join(' ') || undefined;

  const classes = [
    'fc-botao',
    `fc-botao-${variante}`,
    tamanho === 'padrao' ? null : `fc-botao-${tamanho}`,
    soIcone ? 'fc-botao-so-icone' : null,
    desabilitado ? 'fc-botao-desabilitado' : null,
    carregando ? 'fc-botao-carregando' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    // aria-disabled não bloqueia o clique nem o envio do formulário (Enter num campo aciona o botão de envio).
    if (inerte) {
      evento.preventDefault();
      return;
    }
    onClick?.(evento);
  }

  const botao = (
    <BotaoNativo
      {...resto}
      ref={ref}
      type={type}
      className={classes}
      aria-label={soIcone ? rotulo : resto['aria-label']}
      aria-disabled={inerte || undefined}
      aria-busy={carregando || undefined}
      descricao={descritoPor}
      onClick={aoClicar}
    >
      {carregando ? <IconeCarregando className="fc-botao-girando" /> : icone}
      {soIcone ? null : <span className="fc-botao-texto">{children}</span>}
    </BotaoNativo>
  );

  const motivoNaDica = desabilitado && exibirMotivo === 'dica';
  const conteudoDica = soIcone ? (
    motivoNaDica ? (
      <>
        <span className="fc-dica-botao-nome">{rotulo}</span>
        <span>{motivoDesabilitado}</span>
      </>
    ) : (
      rotulo
    )
  ) : motivoNaDica ? (
    motivoDesabilitado
  ) : null;

  const comDica = conteudoDica ? <DicaBotao conteudo={conteudoDica}>{botao}</DicaBotao> : botao;

  if (!desabilitado) return comDica;

  if (exibirMotivo === 'ao-lado') {
    return (
      <span className="fc-botao-com-motivo">
        {comDica}
        <span id={idMotivo} className={`fc-botao-motivo ${classesTexto({ estilo: 'label-12', tom: 'terciario' })}`}>
          <IconeInfo tamanho={12} />
          {motivoDesabilitado}
        </span>
      </span>
    );
  }

  // Na dica, o motivo também fica no DOM (oculto) para o aria-describedby valer com a dica fechada.
  return (
    <>
      {comDica}
      <span id={idMotivo} hidden>
        {motivoDesabilitado}
      </span>
    </>
  );
});
