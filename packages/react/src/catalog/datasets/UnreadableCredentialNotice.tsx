import { Notice, Button } from '../../design-system';

export interface UnreadableCredentialNoticeProps {
  /** The API's own message of the `409 connection_credential_unreadable`. */
  message: string;
  /** The connection of the dataset: its screen is where the credential is replaced. */
  connectionId: string;
  /** Opens a connection (Catalog > Conexões). Without it, only the message shows. */
  onOpenConnection?: (id: string) => void;
}

/** The unreadable credential, in the dataset screens: the API's message and a link to the connection, which has the fix. */
export function UnreadableCredentialNotice({ message, connectionId, onOpenConnection }: UnreadableCredentialNoticeProps) {
  return (
    <Notice
      type="error"
      actions={
        onOpenConnection ? (
          <Button size="small" onClick={() => onOpenConnection(connectionId)}>
            Abrir conexão
          </Button>
        ) : undefined
      }
    >
      {message}
    </Notice>
  );
}
