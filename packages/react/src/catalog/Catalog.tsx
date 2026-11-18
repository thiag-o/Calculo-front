import { useState, type ReactNode } from 'react';
import { Card, EmptyState, Loading, Tabs, Text } from '../design-system';
import { useSession } from '../session';
import { Connections, CONNECTIONS_VIEW } from './connections';
import { DatasetDetail, Datasets } from './datasets';
import { ExcelFiles } from './files';
import './catalog.css';

/** The Catalog tabs, in order. */
export type CatalogTab = 'connections' | 'datasets' | 'files';

/**
 * The permission that opens each tab (contract: the scope of each tab's list route). All three lists ask for
 * `connections.view`; writing is checked inside each tab, action by action.
 */
export const CATALOG_TAB_PERMISSIONS = {
  connections: CONNECTIONS_VIEW,
  datasets: CONNECTIONS_VIEW,
  files: CONNECTIONS_VIEW,
} as const satisfies Record<CatalogTab, string>;

/** The permission that opens the Catalog: any of its tabs. */
export const CATALOG_PERMISSION = CONNECTIONS_VIEW;

/** Where the person is in the Catalog: a tab, and the item open in it (`null`: the tab's list). */
export interface CatalogLocation {
  tab: CatalogTab;
  /** Id of the connection, dataset or file open (the detail), or `null` for the list. */
  id: string | null;
}

const TABS: readonly { id: CatalogTab; label: string }[] = [
  { id: 'connections', label: 'Conexões' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'files', label: 'Arquivos' },
];

export interface CatalogProps {
  /**
   * Where the screen is, when whoever uses it controls the choice (`<FluxoCalculo>` binds it to the routes `/catalog`,
   * `/catalog/datasets`, `/catalog/files` and the details, ADR 0027). Without it, the screen keeps the choice by itself and
   * starts on the Conexões list.
   */
  location?: CatalogLocation;
  /** Called when the person changes tab or opens or closes an item. */
  onLocationChange?: (location: CatalogLocation) => void;
}

/**
 * The whole Catalog: the "Catálogo" title (h1) and the internal tabs Conexões, Datasets and Arquivos, each one only for
 * whoever has its permission (`CATALOG_TAB_PERMISSIONS`), and the detail of the connection, dataset or file opened from
 * them. It is the same screen in the shell sidebar item, in the embedded mode tab and standalone. A file opens the dataset
 * created from one of its sheets on the Datasets tab.
 * Standalone, the choices do not touch the URL. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals of
 * dialogs and menus).
 */
export function Catalog({ location, onLocationChange }: CatalogProps = {}) {
  const session = useSession();
  const [local, setLocal] = useState<CatalogLocation>({ tab: 'connections', id: null });
  const chosen = location ?? local;

  if (!session.data) {
    return (
      <CatalogFrame>
        <Loading label="Carregando o Catálogo" rows={4} />
      </CatalogFrame>
    );
  }

  const visible = TABS.filter((item) => session.hasPermission(CATALOG_TAB_PERMISSIONS[item.id]));
  // The chosen tab may stop being valid (another tenant, roles changed): the first allowed one stays.
  const current = visible.find((item) => item.id === chosen.tab) ?? visible[0];

  if (!current) {
    return (
      <CatalogFrame>
        <Card as="div">
          <EmptyState
            title="Nenhuma parte do Catálogo disponível para você"
            description="Peça ao administrador do cliente as permissões de que precisa."
          />
        </Card>
      </CatalogFrame>
    );
  }

  const id = current.id === chosen.tab ? chosen.id : null;

  function go(next: CatalogLocation) {
    setLocal(next);
    onLocationChange?.(next);
  }

  return (
    <CatalogFrame>
      <Tabs<CatalogTab>
        label="Catálogo"
        size="small"
        className="fc-catalog-tabs"
        items={visible.map((item) => ({ value: item.id, label: item.label }))}
        value={current.id}
        onValueChange={(tab) => go({ tab, id: null })}
      >
        {current.id === 'connections' ? (
          <Connections connectionId={id} onConnectionChange={(next) => go({ tab: 'connections', id: next })} />
        ) : null}
        {current.id === 'datasets' ? (
          id ? (
            <DatasetDetail key={id} datasetId={id} onBack={() => go({ tab: 'datasets', id: null })} />
          ) : (
            <Datasets onOpenDataset={(next) => go({ tab: 'datasets', id: next })} />
          )
        ) : null}
        {current.id === 'files' ? (
          <ExcelFiles
            fileId={id}
            onFileChange={(next) => go({ tab: 'files', id: next })}
            onOpenDataset={(next) => go({ tab: 'datasets', id: next })}
          />
        ) : null}
      </Tabs>
    </CatalogFrame>
  );
}

/** The screen title (h1), the same in every state, and below it the state or the tabs. */
function CatalogFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fc-catalog">
      <Text as="h1" variant="heading-24">
        Catálogo
      </Text>
      {children}
    </div>
  );
}
