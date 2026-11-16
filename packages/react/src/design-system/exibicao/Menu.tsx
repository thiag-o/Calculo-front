import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useId, type ReactElement, type ReactNode } from 'react';
import { usePortalFluxo } from '../raiz';
import './menu.css';

export interface AcaoMenu {
  tipo?: 'acao';
  /** Verbo + objeto, com o mesmo rótulo do resto do produto (estilos.md §13): "Baixar CSV". */
  rotulo: string;
  aoSelecionar: () => void;
  /** Ícone Lucide de 16px à esquerda. */
  icone?: ReactNode;
  /** Ação destrutiva ("Excluir conexão"): texto em vermelho. */
  perigo?: boolean;
  /**
   * Desabilita a ação dizendo o porquê (estilos.md §14), como no `Botao` (ADR 0012). O item continua alcançável
   * pelas setas, com `aria-disabled`, e o motivo aparece embaixo do rótulo e em `aria-describedby`.
   */
  motivoDesabilitado?: string;
}

export interface SeparadorMenu {
  tipo: 'separador';
}

export type ItemMenu = AcaoMenu | SeparadorMenu;

export interface MenuProps {
  /** Elemento que abre o menu, em geral `<Botao soIcone rotulo="Mais ações" icone={…} />`. */
  gatilho: ReactElement;
  itens: readonly ItemMenu[];
  /** Alinhamento do menu com o gatilho. Padrão: `fim` (menus "…" no fim das linhas). */
  alinhamento?: 'inicio' | 'fim';
  aberto?: boolean;
  aoMudarAberto?: (aberto: boolean) => void;
}

/**
 * Menu suspenso (Radix DropdownMenu; estilos.md §4 e §7.1): raio 12px, sombra de menus, itens de 32px com raio 6px.
 * Teclado: Enter, Espaço e seta para baixo abrem; setas, Home, End e a digitação navegam; Enter escolhe;
 * Esc fecha e devolve o foco ao gatilho. O portal fica no contêiner da raiz do módulo (ADR 0011).
 */
export function Menu({ gatilho, itens, alinhamento = 'fim', aberto, aoMudarAberto }: MenuProps) {
  const portal = usePortalFluxo();
  return (
    <DropdownMenu.Root open={aberto} onOpenChange={aoMudarAberto}>
      <DropdownMenu.Trigger asChild>{gatilho}</DropdownMenu.Trigger>
      {portal && (
        <DropdownMenu.Portal container={portal}>
          <DropdownMenu.Content
            className="fc-menu"
            align={alinhamento === 'fim' ? 'end' : 'start'}
            sideOffset={4}
            collisionPadding={8}
          >
            {itens.map((item, indice) =>
              item.tipo === 'separador' ? (
                <DropdownMenu.Separator key={`separador-${indice}`} className="fc-menu-separador" />
              ) : (
                <ItemAcao key={`${item.rotulo}-${indice}`} item={item} />
              ),
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      )}
    </DropdownMenu.Root>
  );
}

function ItemAcao({ item }: { item: AcaoMenu }) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idMotivo = `${id}-motivo`;
  const desabilitado = Boolean(item.motivoDesabilitado);
  const classes = ['fc-menu-item', item.perigo ? 'fc-menu-item-perigo' : null, desabilitado ? 'fc-menu-item-desabilitado' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <DropdownMenu.Item
      className={classes}
      aria-labelledby={idRotulo}
      aria-describedby={desabilitado ? idMotivo : undefined}
      aria-disabled={desabilitado || undefined}
      onSelect={(evento) => {
        // Desabilitado com motivo: não age e mantém o menu aberto, com o motivo à vista.
        if (desabilitado) {
          evento.preventDefault();
          return;
        }
        item.aoSelecionar();
      }}
    >
      {item.icone ? (
        <span className="fc-menu-item-icone" aria-hidden="true">
          {item.icone}
        </span>
      ) : null}
      <span className="fc-menu-item-texto">
        <span id={idRotulo} className="fc-menu-item-rotulo">
          {item.rotulo}
        </span>
        {desabilitado ? (
          <span id={idMotivo} className="fc-menu-item-motivo">
            {item.motivoDesabilitado}
          </span>
        ) : null}
      </span>
    </DropdownMenu.Item>
  );
}
