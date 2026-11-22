import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Notice, Text } from '../../design-system';
import { isSameSessionData } from '../../session';
import { useDownloadExecutionOutput, type Execution, type ExecutionOutputFile } from '../api';
import { downloadReason, outputSummary } from './format';
import { DownloadIcon } from './icons';
import { downloadErrorMessage } from './messages';

/** How long the address of the saved file stays alive: some browsers read it only after the click returns. */
export const RELEASE_FILE_MS = 30_000;

/**
 * Hands the file to the browser: a temporary link with `download`, inside the module (never in the host page's `body`,
 * ADR 0002), clicked and removed at once. Returns the `blob:` address, which the caller releases later.
 */
export function saveFile(file: ExecutionOutputFile, host: HTMLElement): string {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.hidden = true;
  host.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
  return url;
}

/** The longest `setTimeout` delay (about 24,8 days); a later deadline is checked again after it. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Renders again when the file deadline passes, so "Baixar CSV" gets its reason with the screen open (the reason is read
 * against the time of each render).
 */
function useRenderAtExpiry(expiresAt: string | null): void {
  // Each tick renders the screen again and checks the deadline anew (a deadline beyond the longest delay waits again).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const until = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    if (Number.isNaN(until)) return undefined;
    const wait = until - Date.now();
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setTick((count) => count + 1), Math.min(wait, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [expiresAt, tick]);
}

/**
 * "Baixar CSV" (E6-21): downloads the delivered file with the name the back gave it. Disabled with the reason while it
 * runs, when it was aborted or cancelled and once the deadline passed; with a file, says how many lines and until when.
 */
export function DownloadOutput({ execution }: { execution: Execution }) {
  const host = useRef<HTMLSpanElement>(null);
  const queryClient = useQueryClient();
  const download = useDownloadExecutionOutput(execution.id);
  const [saved, setSaved] = useState<string | null>(null);
  useRenderAtExpiry(execution.output.expires_at);
  const reason = downloadReason(execution, new Date());
  // The `blob:` addresses still alive: released after RELEASE_FILE_MS, or at once when the panel closes.
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const files = pending.current;
    return () => {
      for (const [url, timer] of files) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      files.clear();
    };
  }, []);

  function release(url: string) {
    const timer = setTimeout(() => {
      pending.current.delete(url);
      URL.revokeObjectURL(url);
    }, RELEASE_FILE_MS);
    pending.current.set(url, timer);
  }
  const summary = reason ? '' : outputSummary(execution);

  function start() {
    setSaved(null);
    download.mutate(undefined, {
      onSuccess: (file, _variables, mark) => {
        // A file of the previous person or tenant is never saved for the next one (ADR 0015).
        if (!isSameSessionData(queryClient, mark) || !host.current) return;
        release(saveFile(file, host.current));
        setSaved(file.fileName);
      },
    });
  }

  return (
    <div className="fc-execution-download">
      <span ref={host} className="fc-execution-download-action">
        <Button
          variant={reason ? 'secondary' : 'primary'}
          icon={<DownloadIcon />}
          loading={download.isPending}
          disabledReason={reason}
          showReason="beside"
          onClick={start}
        >
          Baixar CSV
        </Button>
      </span>
      {summary ? (
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-execution-download-summary">
          {summary}
        </Text>
      ) : null}
      <span className="fc-visually-hidden" role="status">
        {saved ? `CSV baixado: ${saved}` : ''}
      </span>
      {download.isError ? (
        <Notice type="error" title="Não foi possível baixar o CSV" className="fc-execution-download-error">
          {downloadErrorMessage(download.error)}
        </Notice>
      ) : null}
    </div>
  );
}
