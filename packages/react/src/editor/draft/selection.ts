/**
 * What is selected in the editor, the same for the canvas, the layers and the properties:
 * - `workflow`: nothing selected (the properties show the workflow settings);
 * - `inputs` and `output`: the declared inputs and the output fields;
 * - `node`: a block of `root.nodes`, by id.
 */
export type EditorItem = { type: 'workflow' } | { type: 'inputs' } | { type: 'output' } | { type: 'node'; id: string };

export interface EditorSelection {
  item: EditorItem;
  /**
   * The field to bring into view, as the `path` of a problem (`root.nodes[2].expression`), when the selection came from
   * one (the Problems tab). The properties focus it; `null` otherwise.
   */
  field: string | null;
}

export const WORKFLOW_ITEM: EditorItem = { type: 'workflow' };

export function sameItem(a: EditorItem, b: EditorItem): boolean {
  if (a.type === 'node' && b.type === 'node') return a.id === b.id;
  return a.type === b.type;
}
