import { AccessEvents } from './access';
import './audit.css';

/**
 * Audit screen. In epic 2 it only has the Access section; the configuration log comes in when there is something to record
 * (module routes and tabs: F19). Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function Audit() {
  return (
    <div className="fc-audit">
      <AccessEvents />
    </div>
  );
}
