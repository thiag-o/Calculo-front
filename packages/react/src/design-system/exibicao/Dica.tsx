import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
import { usePortalFluxo } from '../raiz';
import './dica.css';

export type LadoDica = 'cima' | 'baixo' | 'esquerda' | 'direita';

const ladoRadix = { cima: 'top', baixo: 'bottom', esquerda: 'left', direita: 'right' } as const;

export interface DicaProps {
  /** Texto curto da dica ("Abrir editor"). Não coloque nela informação essencial que não esteja em outro lugar. */
  conteudo: ReactNode;
  /**
   * O elemento que mostra a dica. Precisa ser focável e aceitar `ref` (um botão, um link). Recebe os eventos de foco e
   * de ponteiro, e o `aria-describedby` da dica enquanto ela está aberta.
   */
  children: ReactElement;
  /** Padrão: `cima`. */
  lado?: LadoDica;
}

/**
 * Dica (tooltip, estilos.md §7.7): fundo gray-1000, texto background-100, 12px, raio 6px; mesmo visual da dica do
 * `Botao`. Abre no foco e no hover (300 ms), fecha com Esc, no clique e ao sair. O portal fica no contêiner da raiz do
 * módulo (ADR 0011).
 * Para o nome de um botão só com ícone, use `<Botao soIcone rotulo>`, que já mostra a dica.
 */
export function Dica({ conteudo, children, lado = 'cima' }: DicaProps) {
  const portal = usePortalFluxo();
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        {portal && (
          <Tooltip.Portal container={portal}>
            <Tooltip.Content className="fc-dica" side={ladoRadix[lado]} sideOffset={6} collisionPadding={8}>
              {conteudo}
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
