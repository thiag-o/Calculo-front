// Sub-vertical "connections" of the "catalog" vertical (ADR 0003): Catalog › Conexões (list, new connection, detail and
// credential change). This folder's interface; other verticals reach it only through catalog/index.ts (F34).
export { Connections } from './Connections';
export type { ConnectionsProps } from './Connections';
export { ConnectionList } from './ConnectionList';
export type { ConnectionListProps } from './ConnectionList';
export { ConnectionDetail } from './ConnectionDetail';
export type { ConnectionDetailProps } from './ConnectionDetail';
export { CONNECTIONS_VIEW, CONNECTIONS_MANAGE, CREDENTIALS_MANAGE } from './queries';
