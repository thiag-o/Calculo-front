import type { HTMLAttributes } from 'react';
import { classesTexto } from '../tipografia';
import { IconeAlerta } from './icones';
import './campo.css';

/** `dica`: ajuda abaixo do campo (label-12 terciário). `erro`: o que houve e o que fazer (red-900, com ícone). */
export type TipoMensagemCampo = 'dica' | 'erro';

export interface MensagemCampoProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Padrão: `dica`. */
  tipo?: TipoMensagemCampo;
}

/**
 * Mensagem abaixo de um campo (estilos.md §7.2). Ligue ao campo pelo `aria-describedby`; os campos do
 * design-system já fazem isso com as props `dica` e `erro`.
 */
export function MensagemCampo({ tipo = 'dica', className, children, ...resto }: MensagemCampoProps) {
  const classes = [
    'fc-mensagem-campo',
    `fc-mensagem-campo-${tipo}`,
    classesTexto({ estilo: 'label-12', tom: tipo === 'dica' ? 'terciario' : undefined }),
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <p className={classes} {...resto}>
      {tipo === 'erro' ? <IconeAlerta tamanho={12} /> : null}
      <span>{children}</span>
    </p>
  );
}
