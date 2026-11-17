import { useState } from 'react';
import { ExcelFileDetail } from './ExcelFileDetail';
import { ExcelFileList } from './ExcelFileList';

export interface ExcelFilesProps {
  /**
   * Open file (`null`: the list), when whoever uses the screen controls the choice (the module binds it to the route
   * `/catalog/files/:id`, ADR 0027). Without it, the screen keeps the choice by itself and starts on the list.
   */
  fileId?: string | null;
  /** Called when the person opens a file (its id) or goes back to the list (`null`). */
  onFileChange?: (id: string | null) => void;
  /** Opens a dataset created from a sheet (`/catalog/datasets/:id` in the module). */
  onOpenDataset?: (id: string) => void;
}

interface Navigation {
  /** Focus on the detail title (opened from the list). */
  focusTitle: boolean;
  /** Back from this file: the focus goes to its name in the list. */
  listItem?: string;
  /** Name of the file just deleted, said in the list. */
  deleted?: string;
}

/**
 * Catalog › Arquivos: the list of Excel files, with the upload, and the detail of a file, controllable like the tabs
 * (ADR 0027). A file just uploaded opens its detail. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ExcelFiles({ fileId, onFileChange, onOpenDataset }: ExcelFilesProps = {}) {
  const [localId, setLocalId] = useState<string | null>(null);
  // Focus only follows navigation done here, never the first render (the screen may open straight on a detail).
  const [navigation, setNavigation] = useState<Navigation>({ focusTitle: false });
  const openId = fileId === undefined ? localId : fileId;

  function navigate(id: string | null, next: Navigation) {
    setNavigation(next);
    setLocalId(id);
    onFileChange?.(id);
  }

  if (openId) {
    return (
      <ExcelFileDetail
        key={openId}
        fileId={openId}
        focusTitle={navigation.focusTitle}
        onBack={() => navigate(null, { focusTitle: false, listItem: openId })}
        onDeleted={(fileName) => navigate(null, { focusTitle: false, deleted: fileName })}
        onOpenDataset={onOpenDataset}
      />
    );
  }
  return (
    <ExcelFileList
      onOpen={(id) => navigate(id, { focusTitle: true })}
      focusFileId={navigation.listItem}
      deletedFileName={navigation.deleted}
    />
  );
}
