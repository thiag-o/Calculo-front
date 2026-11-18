// Vertical "catalog" (ADR 0003).
// Catalog: connections, datasets (with columns and variables) and Excel files.
// This file is the vertical's public interface; the rest of the folder is private.

// The whole screen, with the internal tabs, and the permissions. The module uses the same screen in the shell and in embedded
// mode, with the tabs and details bound to the routes.
export { Catalog, CATALOG_PERMISSION, CATALOG_TAB_PERMISSIONS } from './Catalog';
export type { CatalogProps, CatalogLocation, CatalogTab } from './Catalog';

// Each tab, standalone (the sub-verticals).
export { Connections, ConnectionList, ConnectionDetail } from './connections';
export { Datasets, DatasetDetail } from './datasets';
export { ExcelFiles, ExcelFileList, ExcelFileDetail } from './files';
