import { useDatasetVariables } from '../../../catalog';
import { Button, Dialog, DialogClose, Loading, Notice } from '../../../design-system';
import { counted, listed } from './labels';
import { withDataset, type CatalogVariable, type SourceNode } from './sourceNode';

export interface DatasetChangeDialogProps {
  node: SourceNode;
  /** The dataset chosen, and its name. */
  datasetId: string;
  datasetName: string;
  /** The variables of the current dataset (empty when they could not be read): they say which namesake each one has. */
  before: readonly CatalogVariable[];
  onConfirm: (node: SourceNode) => void;
  onCancel: () => void;
  focusOnClose: () => HTMLElement | null | undefined;
}

/**
 * "Trocar dataset": the variables the block uses become the ones of the same name, type and places in the new dataset. The dialog reads the
 * new dataset's variables and says, before anything changes, what leaves the block and which links lose their variable.
 */
export function DatasetChangeDialog({ node, datasetId, datasetName, before, onConfirm, onCancel, focusOnClose }: DatasetChangeDialogProps) {
  const variables = useDatasetVariables(datasetId);
  const change = variables.data ? withDataset(node, datasetId, before, variables.data) : null;

  let body;
  let reason: string | undefined;
  if (variables.isPending) {
    body = <Loading label="Carregando as variáveis do dataset" rows={2} />;
    reason = 'Carregando as variáveis do dataset';
  } else if (variables.isError || !change) {
    body = (
      <Notice type="error" actions={<Button onClick={() => void variables.refetch()}>Tentar de novo</Button>}>
        Não foi possível carregar as variáveis de {datasetName}.
      </Notice>
    );
    reason = 'As variáveis do dataset não foram carregadas';
  } else if (change.node === null) {
    body = <Notice type="error">O dataset {datasetName} não tem variáveis. Crie as variáveis no catálogo para usá-lo numa fonte linear.</Notice>;
    reason = 'O dataset não tem variáveis';
  } else {
    const { filters, order, outputs } = change.dropped;
    const leaving = [
      filters > 0 ? counted(filters, 'filtro', 'filtros') : null,
      order > 0 ? counted(order, 'critério de ordenação', 'critérios de ordenação') : null,
      outputs > 0 ? counted(outputs, 'variável da saída', 'variáveis da saída') : null,
    ].filter((item): item is string => item !== null);
    body = (
      <div className="fc-source-dialog-text">
        <p>O bloco passa a usar as variáveis de mesmo nome e mesmo tipo em {datasetName}.</p>
        {leaving.length > 0 ? <p>Sem variável de mesmo nome e mesmo tipo, saem do bloco: {listed(leaving)}.</p> : null}
        {change.unlinked > 0 ? (
          <p>
            {change.unlinked === 1
              ? '1 ligação fica sem a variável do dataset e passa a mostrar um problema.'
              : `${counted(change.unlinked, 'ligação', 'ligações')} ficam sem a variável do dataset e passam a mostrar um problema.`}
          </p>
        ) : null}
        <p>Você pode desfazer com Ctrl Z.</p>
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      focusOnClose={focusOnClose}
      title="Trocar dataset"
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="primary"
            disabledReason={reason}
            onClick={() => {
              if (change?.node) onConfirm(change.node);
            }}
          >
            Trocar dataset
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
