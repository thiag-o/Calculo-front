import { useState } from 'react';
import { ConnectionDetail } from './ConnectionDetail';
import { ConnectionList } from './ConnectionList';

export interface ConnectionsProps {
  /**
   * Open connection (`null`: the list), when whoever uses the screen controls the choice (the module binds it to the route
   * `/catalog/connections/:id`, ADR 0027). Without it, the screen keeps the choice by itself and starts on the list.
   */
  connectionId?: string | null;
  /** Called when the person opens a connection (its id) or goes back to the list (`null`). */
  onConnectionChange?: (id: string | null) => void;
}

/**
 * Catalog › Conexões: the list and the detail of a connection, controllable like the tabs (ADR 0027). Going back from a
 * detail puts the focus on that connection's name in the list; opening one from the list puts it on the detail title.
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function Connections({ connectionId, onConnectionChange }: ConnectionsProps = {}) {
  const [localId, setLocalId] = useState<string | null>(null);
  // Focus only follows navigation done here, never the first render (the screen may open straight on a detail).
  const [focus, setFocus] = useState<{ title: boolean; listItem?: string }>({ title: false });
  const openId = connectionId === undefined ? localId : connectionId;

  function navigate(id: string | null) {
    setFocus(id === null ? { title: false, listItem: openId ?? undefined } : { title: true });
    setLocalId(id);
    onConnectionChange?.(id);
  }

  if (openId) {
    return <ConnectionDetail key={openId} connectionId={openId} focusTitle={focus.title} onBack={() => navigate(null)} />;
  }
  return <ConnectionList onOpen={navigate} focusConnectionId={focus.listItem} />;
}
