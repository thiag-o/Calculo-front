// The menu of a block or group on the canvas (E5-19): Agrupar, Desagrupar, "Mover para o grupo…", "Tirar do grupo" and
// recolher e expandir. One menu open at a time; the canvas keeps which one and builds its items when it opens. The mouse
// opens it by the "Mais ações" button or the right click; the keyboard, by Shift + F10 on the focused node.
import { createContext, useContext } from 'react';
import { Button, Menu, type MenuItem } from '../../design-system';
import { MoreIcon } from '../groups';

export interface NodeMenuState {
  /** The node whose menu is open. */
  openId: string | null;
  setOpenId: (id: string | null) => void;
  /** The items of a node's menu, from the latest definition. */
  itemsFor: (id: string) => MenuItem[];
}

export const NodeMenuContext = createContext<NodeMenuState | null>(null);

/** The "Mais ações" button and the menu of a node. Nothing in read-only (the canvas gives no state). */
export function NodeMenu({ id, name }: { id: string; name: string }) {
  const state = useContext(NodeMenuContext);
  if (!state) return null;
  const open = state.openId === id;
  return (
    <span className="fc-canvas-node-menu nodrag">
      <Menu
        open={open}
        onOpenChange={(next) => state.setOpenId(next ? id : null)}
        items={open ? state.itemsFor(id) : []}
        trigger={
          <Button
            variant="ghost"
            size="small"
            iconOnly
            label={`Mais ações de ${name}`}
            icon={<MoreIcon size={14} />}
            // The keyboard reaches the node itself (Tab passes through the nodes) and opens this menu with Shift + F10.
            tabIndex={-1}
          />
        }
      />
    </span>
  );
}
