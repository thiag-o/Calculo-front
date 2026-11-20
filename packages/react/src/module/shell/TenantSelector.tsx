import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { Menu, Tooltip, type MenuItem } from '../../design-system';
import { useSwitchTenant, type Session } from '../../session';
import { SwitchIcon, FluxoBrand } from '../icons';
import { Avatar } from './Avatar';

export interface TenantSelectorProps {
  session: Session;
  /** The switch worked: the notice of a previous failure can go away. */
  onSwitch: () => void;
  onFailure: (error: Error) => void;
  /** A workflow is open: the tenant name is a link to the Início, and the switch is a button of its own beside it. */
  homeLink?: boolean;
  /** Icons-only sidebar: the tenant name shows in a tooltip on the link and on the switch button. */
  compact?: boolean;
}

/**
 * Context selector at the top of the sidebar (estilos.md §9, design.md §15): the current tenant, with ⇅.
 * Opens the list of the user's tenants; picking another switches through `useSwitchTenant`. With a single tenant, shows the
 * name without a button, because there is nothing to switch.
 */
export function TenantSelector({ session, onSwitch, onFailure, homeLink = false, compact = false }: TenantSelectorProps) {
  const switchTenant = useSwitchTenant();
  const current = session.current_tenant;

  const identification = (
    <>
      <FluxoBrand />
      <Avatar name={current.name} tone="neutral" />
      <span className="fc-tenant-selector-name">{current.name}</span>
    </>
  );

  const homeLinkElement = (
    <Link to="/home" className="fc-tenant-selector fc-tenant-selector-button fc-tenant-selector-home" aria-label={`Início de ${current.name}`}>
      {identification}
    </Link>
  );
  const identificationLink = compact ? (
    <Tooltip content={current.name} side="right">
      {homeLinkElement}
    </Tooltip>
  ) : (
    homeLinkElement
  );

  if (session.tenants.length <= 1) {
    if (homeLink) return <div className="fc-tenant-selector-row">{identificationLink}</div>;
    return (
      <div className="fc-tenant-selector">
        {identification}
        <span className="fc-module-hidden"> (cliente atual)</span>
      </div>
    );
  }

  const items: MenuItem[] = session.tenants.map((tenant) =>
    tenant.id === current.id
      ? { label: tenant.name, disabledReason: 'Cliente atual', onSelect: () => undefined }
      : {
          label: tenant.name,
          onSelect: () => {
            if (switchTenant.isPending) return;
            switchTenant.mutate(tenant.id, { onSuccess: onSwitch, onError: onFailure });
          },
        },
  );

  const menu = (
    <Menu
      align="start"
      items={items}
      trigger={
        <SwitchButton
          tooltip={homeLink && compact ? current.name : undefined}
          className={`fc-tenant-selector fc-tenant-selector-button${homeLink ? ' fc-tenant-selector-switch-button' : ''}`}
          aria-label={`Trocar cliente. Atual: ${current.name}`}
          aria-busy={switchTenant.isPending || undefined}
        >
          {homeLink ? null : identification}
          <span className="fc-tenant-selector-switch">
            <SwitchIcon />
          </span>
        </SwitchButton>
      }
    />
  );

  return homeLink ? (
    <div className="fc-tenant-selector-row">
      {identificationLink}
      {menu}
    </div>
  ) : (
    menu
  );
}

interface SwitchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip text; without it, the button has no tooltip. */
  tooltip?: string;
}

/** The switch button, with an optional tooltip. Forwards the ref and props so the menu can use it as its trigger. */
const SwitchButton = forwardRef<HTMLButtonElement, SwitchButtonProps>(function SwitchButton({ tooltip, ...props }, ref) {
  const button = <button type="button" ref={ref} {...props} />;
  return tooltip ? (
    <Tooltip content={tooltip} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
});
