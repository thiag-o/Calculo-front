import { useEffect, useState } from 'react';
import { retryAfterSeconds, tooManyTestsMessage } from './messages';

/**
 * The wait imposed by a `429 too_many_connection_tests` on "Testar" (E4-16). It starts when the error arrives and counts down
 * by itself, even if the form later clears the error (typing resets the test): the wait is the server's, not the form's.
 * `reason` is the disabled reason of "Testar" while the wait lasts, with the seconds left; `undefined` after it.
 */
export function useTestCooldown(error: unknown): { reason: string | undefined } {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seconds = retryAfterSeconds(error);

  useEffect(() => {
    if (seconds === undefined) return;
    const started = Date.now();
    setNow(started);
    setDeadline(started + seconds * 1000);
  }, [error, seconds]);

  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline]);

  const secondsLeft = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return { reason: secondsLeft > 0 ? tooManyTestsMessage(secondsLeft) : undefined };
}
