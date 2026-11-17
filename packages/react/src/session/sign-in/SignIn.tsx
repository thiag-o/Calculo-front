import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient, ApiProvider } from '../../api';
import { FluxoRoot, type FluxoTheme } from '../../design-system';
import { SignInScreen, type SignInScreenProps } from './SignInScreen';

export interface SignInProps extends SignInScreenProps {
  /** API address, without `/v1`. Sign-in always uses the session cookie (shell app). */
  apiUrl: string;
  /** Default: `system`. */
  theme?: FluxoTheme;
}

/**
 * Shell app sign-in screen, complete: module root (tokens and theme), its own API client in cookie mode and
 * QueryClient. After sign-in, `onSignIn` gets the session; the shell then mounts `<FluxoCalculo>`.
 */
export function SignIn({ apiUrl, theme, onSignIn }: SignInProps) {
  const [queryClient] = useState(createQueryClient);
  return (
    <FluxoRoot theme={theme} className="fc-sign-in-root">
      <ApiProvider apiUrl={apiUrl}>
        <QueryClientProvider client={queryClient}>
          <SignInScreen onSignIn={onSignIn} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
}
