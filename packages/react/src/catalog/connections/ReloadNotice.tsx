import { useState } from 'react';
import { Notice, Button } from '../../design-system';

export interface ReloadNoticeProps {
  /** The API's own message of the `409 connection_changed`. */
  message: string;
  /** Fetches the connection again. Nothing is sent again by itself. */
  onReload: () => Promise<unknown>;
}

/** The version conflict of a connection: the API's message and "Recarregar", which only fetches the connection again. */
export function ReloadNotice({ message, onReload }: ReloadNoticeProps) {
  const [loading, setLoading] = useState(false);
  return (
    <Notice
      type="error"
      actions={
        <Button
          size="small"
          loading={loading}
          onClick={() => {
            setLoading(true);
            void onReload().finally(() => setLoading(false));
          }}
        >
          Recarregar
        </Button>
      }
    >
      {message}
    </Notice>
  );
}
