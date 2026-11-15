import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
import { usePortalFluxo } from '../raiz';

interface DicaBotaoProps {
  /** O botão (um elemento <button>). Recebe os eventos de foco e de ponteiro que abrem a dica. */
  children: ReactElement;
  conteudo: ReactNode;
}

/**
 * Dica (tooltip) do Botao: abre no foco e no hover, fecha com Esc, no clique e ao sair.
 * O portal fica dentro da raiz do módulo, nunca no body (ADR 0011).
 * O texto da dica não entra no aria-describedby pelo Radix: o Botao já descreve o motivo por conta própria,
 * e a descrição não pode depender de a dica estar aberta.
 */
export function DicaBotao({ children, conteudo }: DicaBotaoProps) {
  const portal = usePortalFluxo();
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        {portal && (
          <Tooltip.Portal container={portal}>
            <Tooltip.Content className="fc-dica-botao" side="top" sideOffset={6} collisionPadding={8}>
              {conteudo}
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
