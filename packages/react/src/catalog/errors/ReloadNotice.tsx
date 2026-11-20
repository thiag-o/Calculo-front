import { useState } from 'react';
import { Notice, Button } from '../../design-system';
import { CHANGED_DEFAULT_MESSAGE } from './conflicts';

export const RELOAD_FAILED_MESSAGE = 'Não foi possível recarregar agora. O que você digitou continua aqui; tente de novo.';

export interface ReloadNoticeProps {
  /** The API's own message of the `409 *_changed`; without one, a default text shows. */
  message?: string;
  /** Fetches the data again; it must reject when the fetch fails. Nothing is sent again by itself. */
  onReload: () => Promise<unknown>;
}

/**
 * The version conflict: the API's message and "Recarregar", which only fetches the data again. When the fetch itself fails,
 * the notice says so and offers "Tentar de novo"; whoever owns it keeps its dialog open, so nothing typed is lost.
 */
export function ReloadNotice({ message, onReload }: ReloadNoticeProps) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Notice
      type="error"
      actions={
        <Button
          size="small"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setFailed(false);
            onReload().then(
              () => setLoading(false),
              () => {
                setLoading(false);
                setFailed(true);
              },
            );
          }}
        >
          {failed ? 'Tentar de novo' : 'Recarregar'}
        </Button>
      }
    >
      {message || CHANGED_DEFAULT_MESSAGE}
      {failed ? <span role="alert">{` ${RELOAD_FAILED_MESSAGE}`}</span> : null}
    </Notice>
  );
}
