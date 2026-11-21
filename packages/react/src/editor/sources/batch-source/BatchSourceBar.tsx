import { memo, type ReactNode } from 'react';
import { DATASET_TYPE_LABELS, useDatasetList } from '../../../catalog';
import { textClasses } from '../../../design-system';
import type { DraftSymbol } from '../../draft';
import { batchSourceBarRows, type BatchSource, type BatchSourceBarRow } from './batchSource';
import { KeyIcon } from './icons';
import { BATCH_SOURCE_TITLE, UNKNOWN_DATASET } from './messages';
import './batch-source.css';

export interface BatchSourceBarProps {
  source: BatchSource;
  /** The symbols of the analysis: the type of each variable brought (origin `batch_source`). */
  symbols: readonly DraftSymbol[];
  /** Selected on the canvas (estilos §8: border and 1px outline in gray-1000). */
  selected?: boolean;
  /** The problems mark of the header (the canvas draws the same one in every node). */
  problems?: ReactNode;
  /** What anchors the links of a variable (the canvas puts a React Flow handle here); nothing by default. */
  renderHandle?: (row: BatchSourceBarRow) => ReactNode;
}

/**
 * The Fonte do lote bar of the canvas (E5-17), in the place of the Entradas bar when the workflow has a batch source: the
 * dataset (name and type), and the variables brought, the key ones with the key icon. It uses the canvas bar classes,
 * so it looks like the Entradas and Saída bars beside it.
 */
export const BatchSourceBar = memo(function BatchSourceBar({ source, symbols, selected = false, problems, renderHandle }: BatchSourceBarProps) {
  const datasets = useDatasetList();
  const dataset = datasets.data?.find((candidate) => candidate.id === source.dataset_id);
  const rows = batchSourceBarRows(source, symbols);
  return (
    <div className="fc-canvas-bar fc-batch-source-bar" data-bar="batch-source" data-selected={selected ? 'true' : undefined}>
      <div className="fc-canvas-bar-head">
        <span className="fc-canvas-category" data-kind="inputs" aria-hidden="true" />
        <span className="fc-canvas-bar-title">{BATCH_SOURCE_TITLE}</span>
        {problems}
      </div>
      <p className={`fc-batch-source-bar-dataset ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
        <span className="fc-batch-source-bar-dataset-name">{dataset ? dataset.name : datasets.isSuccess ? UNKNOWN_DATASET : 'Carregando dataset'}</span>
        {dataset ? <span> · {DATASET_TYPE_LABELS[dataset.type]}</span> : null}
      </p>
      {rows.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label="Variáveis da fonte do lote">
          {rows.map((row) => (
            <li key={row.name} className="fc-canvas-port" data-side="out" data-key={row.key ? 'true' : undefined}>
              {renderHandle?.(row)}
              {row.key ? (
                <span className="fc-batch-source-key" role="img" aria-label="chave">
                  <KeyIcon size={12} />
                </span>
              ) : null}
              <span className={`fc-canvas-port-name ${textClasses({ variant: 'mono-12' })}`}>{row.name}</span>
              {row.type ? <span className={`fc-canvas-port-type ${textClasses({ variant: 'mono-12', emphasis: 'tertiary' })}`}>{row.type}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`fc-canvas-bar-empty ${textClasses({ variant: 'label-12', emphasis: 'tertiary' })}`}>Nenhuma variável</p>
      )}
    </div>
  );
});
