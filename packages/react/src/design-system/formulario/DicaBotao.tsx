import type { ReactElement, ReactNode } from 'react';
import { Dica } from '../exibicao/Dica';

interface DicaBotaoProps {
  /** O botão (um elemento <button>). Recebe os eventos de foco e de ponteiro que abrem a dica. */
  children: ReactElement;
  conteudo: ReactNode;
}

/**
 * Dica (tooltip) do Botao: reaproveita a `Dica` (foco, hover, Esc, portal dentro da raiz), só empilha nome e motivo.
 * O texto da dica não entra no aria-describedby pelo Radix: o Botao já descreve o motivo por conta própria,
 * e a descrição não pode depender de a dica estar aberta.
 */
export function DicaBotao({ children, conteudo }: DicaBotaoProps) {
  return <Dica conteudo={<span className="fc-dica-botao-conteudo">{conteudo}</span>}>{children}</Dica>;
}
