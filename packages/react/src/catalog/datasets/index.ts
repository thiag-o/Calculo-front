// Sub-vertical "datasets" of the "catalog" vertical (ADR 0003): Catalog › Datasets and the dataset detail
// (the variables join the detail in F33). This folder's interface; other verticals reach the catalog only through
// catalog/index.ts (F34).
export { Datasets } from './Datasets';
export type { DatasetsProps } from './Datasets';
export { DatasetDetail } from './DatasetDetail';
export type { DatasetDetailProps } from './DatasetDetail';
