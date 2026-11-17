import { Menu, type MenuItem } from '../../design-system';
import { useSwitchTenant, type Session } from '../../session';
import { SwitchIcon, FluxoBrand } from '../icons';
import { Avatar } from './Avatar';

export interface TenantSelectorProps {
  session: Session;
  /** The switch worked: the notice of a previous failure can go away. */
  onSwitch: () => void;
  onFailure: (error: Error) => void;
}

/**
 * Context selector at the top of the sidebar (estilos.md §9, design.md §15): the current tenant, with ⇅.
 * Opens the list of the user's tenants; picking another switches through `useSwitchTenant`. With a single tenant, shows the
 * name without a button, because there is nothing to switch.
 */
export function TenantSelector({ session, onSwitch, onFailure }: TenantSelectorProps) {
  const switchTenant = useSwitchTenant();
  const current = session.tenant_atual;

  const identification = (
    <>
      <FluxoBrand />
      <Avatar name={current.nome} tone="neutral" />
      <span className="fc-tenant-selector-name">{current.nome}</span>
    </>
  );

  if (session.tenants.length <= 1) {
    return (
      <div className="fc-tenant-selector">
        {identification}
        <span className="fc-module-hidden"> (cliente atual)</span>
      </div>
    );
  }

  const items: MenuItem[] = session.tenants.map((tenant) =>
    tenant.id === current.id
      ? { label: tenant.nome, disabledReason: 'Cliente atual', onSelect: () => undefined }
      : {
          label: tenant.nome,
          onSelect: () => {
            if (switchTenant.isPending) return;
            switchTenant.mutate(tenant.id, { onSuccess: onSwitch, onError: onFailure });
          },
        },
  );

  return (
    <Menu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          className="fc-tenant-selector fc-tenant-selector-button"
          aria-label={`Trocar cliente. Atual: ${current.nome}`}
          aria-busy={switchTenant.isPending || undefined}
        >
          {identification}
          <span className="fc-tenant-selector-switch">
            <SwitchIcon />
          </span>
        </button>
      }
    />
  );
}
