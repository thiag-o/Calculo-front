import { useState } from 'react';
import { useDatasetVariables, type Dataset, type Variable } from '../../catalog';
import { Button, Dialog, DialogClose, Loading, Notice, Text } from '../../design-system';
import { DatasetSearch } from '../sources/batch-source';
import {
  NEW_SOURCE_CONFIRM,
  NEW_SOURCE_DESCRIPTION,
  NEW_SOURCE_NO_VARIABLES,
  NEW_SOURCE_TITLE,
  NEW_SOURCE_VARIABLES_ERROR,
  newSourceDatasetText,
} from './messages';

export interface NewSourceDialogProps {
  /** The dataset is chosen and its variables are in: the Fonte block is included over them. */
  onCreate: (dataset: Dataset, variables: readonly Variable[]) => void;
  onClose: () => void;
  /** Who gets the focus back when the dialog closes (the "Fonte" button). */
  focusOnClose?: () => HTMLElement | null | undefined;
}

/**
 * The "Fonte" button of the toolbar (E5-18): a Fonte needs a dataset of the catalog and at least one variable from it, so
 * the dataset is chosen first (the same search as the batch source) and the block comes with the variables of the dataset.
 */
export function NewSourceDialog({ onCreate, onClose, focusOnClose }: NewSourceDialogProps) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  return (
    <Dialog
      open
      title={NEW_SOURCE_TITLE}
      description={NEW_SOURCE_DESCRIPTION}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      focusOnClose={focusOnClose}
      actions={
        <DialogClose>
          <Button variant="secondary">Cancelar</Button>
        </DialogClose>
      }
    >
      {dataset === null ? (
        <DatasetSearch value={null} path={null} autoFocus onChoose={setDataset} />
      ) : (
        <ChosenDataset dataset={dataset} onChange={() => setDataset(null)} onCreate={onCreate} />
      )}
    </Dialog>
  );
}

interface ChosenDatasetProps {
  dataset: Dataset;
  onChange: () => void;
  onCreate: NewSourceDialogProps['onCreate'];
}

/** The dataset chosen: its variables load, and "Incluir Fonte" waits for them. */
function ChosenDataset({ dataset, onChange, onCreate }: ChosenDatasetProps) {
  const variables = useDatasetVariables(dataset.id);
  if (variables.isPending) return <Loading label="Carregando as variáveis do dataset" rows={3} />;
  if (variables.isError) {
    return (
      <Notice
        type="error"
        title={NEW_SOURCE_VARIABLES_ERROR}
        actions={
          <>
            <Button size="small" loading={variables.isFetching} onClick={() => void variables.refetch()}>
              Tentar de novo
            </Button>
            <Button size="small" variant="ghost" onClick={onChange}>
              Trocar dataset
            </Button>
          </>
        }
      >
        Tente de novo ou escolha outro dataset.
      </Notice>
    );
  }
  const empty = variables.data.length === 0;
  return (
    <div className="fc-canvas-new-source">
      <Text as="p" variant="label-13">
        {newSourceDatasetText(dataset.name, variables.data.length)}
      </Text>
      {empty ? <Notice type="warning">{NEW_SOURCE_NO_VARIABLES}</Notice> : null}
      <div className="fc-canvas-new-source-actions">
        <Button variant="ghost" onClick={onChange}>
          Trocar dataset
        </Button>
        <Button variant="primary" disabledReason={empty ? NEW_SOURCE_NO_VARIABLES : undefined} onClick={() => onCreate(dataset, variables.data)}>
          {NEW_SOURCE_CONFIRM}
        </Button>
      </div>
    </div>
  );
}
