// Vertical "editor" (ADR 0003).
// Workflow editor (React Flow): canvas, layers, properties, blocks, groups and Decision Table.
// This file is the vertical's public interface; the rest of the folder is private.

// The editor screen: layout, canvas, layers, properties (batch source, Fonte, group, Calculation, Decision Table), the grid and the
// Problemas, Prévia and Calcular tabs.
export { Editor } from './Editor';
export type { EditorProps } from './Editor';

// The note of a change the editor could not save on close, for the screens that follow it (F74).
export { UnsavedChangesNotice } from './draft';
export type { UnsavedChangesNoticeProps } from './draft';
