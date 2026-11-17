import { Menu } from '../../design-system';
import { useSignOut, type Session } from '../../session';
import { useEndSession } from '../sessionEnd';
import { SignOutIcon } from '../icons';
import { Avatar } from './Avatar';

export interface UserMenuProps {
  user: Session['usuario'];
  onFailure: (error: Error) => void;
}

/**
 * Whoever is signed in, at the sidebar footer, with the account menu ("Sair"). After signing out, the module ends the
 * session and notifies the host app through `onSessionExpired` (in the shell, back to sign-in).
 */
export function UserMenu({ user, onFailure }: UserMenuProps) {
  const signOut = useSignOut();
  const end = useEndSession();

  return (
    <Menu
      align="start"
      items={[
        {
          label: 'Sair',
          icon: <SignOutIcon />,
          onSelect: () => {
            if (signOut.isPending) return;
            signOut.mutate(undefined, { onSuccess: end, onError: onFailure });
          },
        },
      ]}
      trigger={
        <button
          type="button"
          className="fc-user"
          aria-label={`${user.nome}: opções da conta`}
          aria-busy={signOut.isPending || undefined}
        >
          <Avatar name={user.nome} tone="strong" />
          <span className="fc-user-text">
            <span className="fc-user-name">{user.nome}</span>
            <span className="fc-user-email">{user.email}</span>
          </span>
        </button>
      }
    />
  );
}
