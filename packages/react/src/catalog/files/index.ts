// Sub-vertical "files" of the "catalog" vertical (ADR 0003): Catalog › Arquivos (list and upload of Excel files, and the
// detail of a file with its sheets). This folder's interface; other verticals reach it only through catalog/index.ts (F34).
export { ExcelFiles } from './ExcelFiles';
export type { ExcelFilesProps } from './ExcelFiles';
export { ExcelFileList } from './ExcelFileList';
export type { ExcelFileListProps } from './ExcelFileList';
export { ExcelFileDetail } from './ExcelFileDetail';
export type { ExcelFileDetailProps } from './ExcelFileDetail';
export { DATASETS_MANAGE } from './queries';
