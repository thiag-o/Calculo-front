import { useEffect, useState } from 'react';
import { retryAfterSeconds, tooManyTestsMessage } from './messages';

/** What a screen reader hears when the wait ends (once; the seconds in between are not announced). */
export const COOLDOWN_RELEASED_MESSAGE = 'Já é possível testar de novo.';

interface Wait {
  /** The error that started it: a new `429` (a new object) starts a new wait. */
  error: unknown;
  seconds: number;
  deadline: number;
}

/**
 * The wait imposed by a `429 too_many_connection_tests` on "Testar" (E4-16). It starts when the error arrives and counts down
 * by itself, even if the form later clears the error (typing resets the test): the wait is the server's, not the form's.
 * - `reason`: the disabled reason of "Testar" while the wait lasts, with the seconds left; `undefined` after it.
 * - `announcement`: the text for an `aria-live` region, that changes only twice: the full wait at the start and the release
 *   at the end (the visible count is not read second by second).
 * The wait is derived while rendering (no effect sets it), so "Testar" is never enabled, not even for a frame, after the `429`.
 */
export function useTestCooldown(error: unknown): { reason: string | undefined; announcement: string } {
  const seconds = retryAfterSeconds(error);
  const [wait, setWait] = useState<Wait | null>(null);
  const [now, setNow] = useState(() => Date.now());

  let current = wait;
  if (seconds !== undefined && wait?.error !== error) {
    const started = Date.now();
    current = { error, seconds, deadline: started + seconds * 1000 };
    // Adjusting state while rendering: React renders again before painting, with the wait already in place.
    setWait(current);
    setNow(started);
  }

  const deadline = current?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline]);

  if (current === null) return { reason: undefined, announcement: '' };
  const secondsLeft = Math.max(0, Math.ceil((current.deadline - now) / 1000));
  return secondsLeft > 0
    ? { reason: tooManyTestsMessage(secondsLeft), announcement: tooManyTestsMessage(current.seconds) }
    : { reason: undefined, announcement: COOLDOWN_RELEASED_MESSAGE };
}
