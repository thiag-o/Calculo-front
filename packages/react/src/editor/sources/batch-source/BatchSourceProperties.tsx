import { Text } from '../../../design-system';
import { useDraftEditor } from '../../draft';
import { PropertiesFrame } from '../../properties';
import { BatchSourceFields, type BatchSourceFieldsProps } from './BatchSourceFields';
import { BATCH_SOURCE_TITLE } from './messages';

export type BatchSourcePropertiesProps = Pick<BatchSourceFieldsProps, 'renderFilters'>;

/**
 * The batch source on its own in the Propriedades panel (the Fonte do lote bar selected on the canvas): the same fields
 * as in the workflow panel, under the title "Fonte do lote".
 */
export function BatchSourceProperties({ renderFilters }: BatchSourcePropertiesProps) {
  const { definition } = useDraftEditor();
  const source = definition.root.batch_source;
  return (
    <PropertiesFrame title={BATCH_SOURCE_TITLE} category="source">
      {source ? (
        <BatchSourceFields source={source} renderFilters={renderFilters} />
      ) : (
        <Text as="p" variant="label-13" emphasis="secondary">
          O workflow usa entradas declaradas. Para ler os registros de um dataset, escolha Fonte do lote nas propriedades do workflow.
        </Text>
      )}
    </PropertiesFrame>
  );
}
