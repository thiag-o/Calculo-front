import { ApiKeys } from './ApiKeys';
import { AuthorizedDomains } from './AuthorizedDomains';
import './integration.css';

/**
 * Admin › Integration: the API keys (for the host app backend to request tokens) and the authorized domains
 * (where the embedded module may call the API from), in two sections. Each section is an area with its own main action.
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals of dialogs and menus).
 */
export function Integration() {
  return (
    <div className="fc-integration">
      <ApiKeys />
      <AuthorizedDomains />
    </div>
  );
}
