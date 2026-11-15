import type { HTMLAttributes, ReactNode } from 'react';
import { IconeAlerta } from '../formulario/icones';
import { IconeAtencao, IconeSucesso } from './icones';
import './aviso.css';

/** `erro` (red), `atencao` (amber) e `sucesso` (green): fundo -100 e texto -900 (estilos.md §7.7). */
export type TipoAviso = 'sucesso' | 'erro' | 'atencao';

export interface AvisoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  tipo: TipoAviso;
  /** Resumo em peso 500, antes do texto. Opcional. */
  titulo?: ReactNode;
  /** O que houve, onde e o que fazer (estilos.md §14). Sem "Ops!" nem exclamação. */
  children: ReactNode;
  /** Ações para resolver, abaixo da nota ("Abrir catálogo", "Tentar de novo"). */
  acoes?: ReactNode;
}

const icones: Record<TipoAviso, ReactNode> = {
  erro: <IconeAlerta tamanho={14} />,
  atencao: <IconeAtencao tamanho={14} />,
  sucesso: <IconeSucesso tamanho={14} />,
};

/**
 * Nota inline (estilos.md §7.7 e §14): fundo -100, texto -900, raio 6px, ícone de 14px, sem borda lateral.
 * O erro é `alert` (anunciado na hora); sucesso e atenção são `status` (anunciados sem interromper).
 */
export function Aviso({ tipo, titulo, acoes, className, children, ...resto }: AvisoProps) {
  const nota = (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={['fc-aviso', `fc-aviso-${tipo}`, acoes ? null : className].filter(Boolean).join(' ')}
      {...(acoes ? {} : resto)}
    >
      {icones[tipo]}
      <div className="fc-aviso-texto">
        {titulo ? <p className="fc-aviso-titulo">{titulo}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );

  if (!acoes) return nota;

  return (
    <div className={['fc-aviso-bloco', className].filter(Boolean).join(' ')} {...resto}>
      {nota}
      <div className="fc-aviso-acoes">{acoes}</div>
    </div>
  );
}
