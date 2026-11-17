import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient, ApiProvider } from '../../api';
import { FluxoRoot, type FluxoTheme } from '../../design-system';
import { ResetPasswordScreen, type ResetPasswordScreenProps } from './ResetPasswordScreen';

export interface ResetPasswordProps extends ResetPasswordScreenProps {
  /** API address, without `/v1`. The reset routes are public (no session and no CSRF). */
  apiUrl: string;
  /** Default: `system`. */
  theme?: FluxoTheme;
}

/**
 * Public new-password screen from the reset link, complete: module root (tokens and theme), its own API client and
 * QueryClient. The `token` is the link's, not the embed one. After saving, `onSave` is called; the
 * shell then takes the person to sign-in.
 */
export function ResetPassword({ apiUrl, theme, token, onSave }: ResetPasswordProps) {
  const [queryClient] = useState(createQueryClient);
  return (
    <FluxoRoot theme={theme} className="fc-reset-password-root">
      <ApiProvider apiUrl={apiUrl}>
        <QueryClientProvider client={queryClient}>
          <ResetPasswordScreen token={token} onSave={onSave} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
}
