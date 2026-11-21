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

// The pt-BR names of the data types (`DataType`), also used by the editor's properties (F53).
export { DATA_TYPE_LABELS, dataTypeLabel } from './columns';

// The tenant datasets and the variables of each, with the name of each dataset type, read by the editor's sources (E5-16).
export { useDatasetList, useDatasetVariables } from './datasets/queries';
export type { Dataset, Variable } from './datasets/queries';
export { DATASET_TYPE_LABELS } from './datasets/origin';
