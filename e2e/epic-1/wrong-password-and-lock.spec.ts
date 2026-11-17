// Epic 1 · wrong password and sign-in lock (both modes).
import { expect, test } from '../support/fixtures';
import { signInNotice, passwordField, problemBody, submitSignIn, waitForSignIn, waitForModule } from '../support/screens';
import type { Session } from '../support/contract';

/** Backend rule (G4): the 5th consecutive failure locks the e-mail; the next attempt is already rejected. */
const FAILURES_UNTIL_LOCK = 5;
const TIME_ZONE = 'America/Sao_Paulo';

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos. Confira os dados e tente de novo.';

test.use({ timezoneId: TIME_ZONE });

/** "Tente de novo às HH:MM" (and " de DD/MM" if the unlock falls on another day), in the test browser's time zone. */
function unlockText(unlocksAt: string): string {
  const when = new Date(unlocksAt);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(when);
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE });
  const otherDay = day.format(when) !== day.format(new Date());
  const suffix = otherDay ? ` de ${day.format(when).slice(0, 5)}` : '';
  return `Tente de novo às ${time}${suffix}.`;
}

test.describe('senha errada e bloqueio', () => {
  test('senha errada mostra a mensagem genérica e deixa tentar de novo', async ({ page, api }) => {
    const account = api.account('admin');
    await page.goto('/sign-in');

    const rejection = await submitSignIn(page, { email: account.email, password: `${account.password}-errada` });

    expect(rejection.status()).toBe(401);
    expect((await problemBody(rejection)).code).toBe('invalid_credentials');
    await expect(signInNotice(page)).toHaveText(INVALID_CREDENTIALS_MESSAGE);
    await waitForSignIn(page);
    // The message does not blame a single field (it does not reveal whether the e-mail exists).
    await expect(passwordField(page)).not.toHaveAttribute('aria-invalid', 'true');

    const success = await submitSignIn(page, account);

    expect(success.status()).toBe(200);
    await waitForModule(page, (await success.json()) as Session);
  });

  test('cinco erros seguidos bloqueiam o e-mail e a tela diz quando tentar de novo', async ({ page, api }) => {
    // A new e-mail each run: in real mode the lock lasts 15 minutes and must not hit the other tests' accounts.
    const credentials = { email: api.emailWithoutAccount(), password: 'senha-que-nao-confere' };
    await page.goto('/sign-in');

    for (let attempt = 1; attempt <= FAILURES_UNTIL_LOCK; attempt += 1) {
      const rejection = await submitSignIn(page, credentials);
      expect(rejection.status(), `tentativa ${attempt}`).toBe(401);
      await expect(signInNotice(page)).toHaveText(INVALID_CREDENTIALS_MESSAGE);
    }

    const lock = await submitSignIn(page, credentials);

    expect(lock.status()).toBe(423);
    const body = await problemBody(lock);
    expect(body.code).toBe('login_locked');
    const unlocksAt = (body as { unlocks_at?: unknown }).unlocks_at;
    expect(typeof unlocksAt).toBe('string');
    await expect(signInNotice(page)).toHaveText(
      `O login deste e-mail foi bloqueado depois de várias tentativas erradas. ${unlockText(unlocksAt as string)}`,
    );
    await waitForSignIn(page);
  });
});
