// Entry point of the shell app (host app zero, ADR 0002).
// The shell has no business rules: sign-in and the product live in @fluxo/react.
import { SignIn, FluxoCalculo, ResetPassword } from '@fluxo/react';
import '@fluxo/react/styles.css';
import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiUrl } from './environment';
import { EnvironmentLabel } from './EnvironmentLabel';

const SIGN_IN_ROUTE = '/sign-in';
const INITIAL_ROUTE = '/home';
const RESET_ROUTE = '/reset-password';
// Path of the reset link the backend still generates (`<FLUXO_URL_CASCA>/redefinir?token=...`), until the API
// migration (F42/B48) moves it to RESET_ROUTE.
const LEGACY_RESET_ROUTE = '/redefinir';

// Public route /reset-password?token=...: the reset link token comes from the URL.
function onResetRoute(): boolean {
  return window.location.pathname === RESET_ROUTE || window.location.pathname === LEGACY_RESET_ROUTE;
}

function readLinkToken(): string {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

function onSignInRoute(): boolean {
  return window.location.pathname === SIGN_IN_ROUTE;
}

function goTo(path: string) {
  window.history.pushState(null, '', path);
}

function Shell() {
  const [signingIn, setSigningIn] = useState(onSignInRoute);
  const [resetting, setResetting] = useState(onResetRoute);
  const [linkToken] = useState(readLinkToken);

  // Password saved: go on to sign-in.
  const onReset = useCallback(() => {
    goTo(SIGN_IN_ROUTE);
    setResetting(false);
    setSigningIn(true);
  }, []);

  // After sign-in the URL becomes /home and the module (url mode, basename "/") takes over navigation.
  const onSignIn = useCallback(() => {
    goTo(INITIAL_ROUTE);
    setSigningIn(false);
  }, []);

  // Session expired or "Sair" (ADR 0019): back to sign-in.
  const onSessionEnd = useCallback(() => {
    goTo(SIGN_IN_ROUTE);
    setSigningIn(true);
  }, []);

  return (
    <>
      {resetting ? (
        <ResetPassword apiUrl={apiUrl} token={linkToken} onSave={onReset} />
      ) : signingIn ? (
        <SignIn apiUrl={apiUrl} onSignIn={onSignIn} />
      ) : (
        <FluxoCalculo apiUrl={apiUrl} navigation="url" onSessionExpired={onSessionEnd} />
      )}
      <EnvironmentLabel />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado em index.html.');
createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
