import { Text } from '../design-system';
import { AccessEvents } from './access';
import './audit.css';

/**
 * Audit screen: the "Auditoria" title (h1) and its sections, each with its own h2. In epic 2 it only has the Access section;
 * the configuration log comes in when there is something to record (module routes and tabs: F19). Needs `ApiProvider`,
 * `QueryClientProvider` and `FluxoRoot`.
 */
export function Audit() {
  return (
    <div className="fc-audit">
      <Text as="h1" variant="heading-24">
        Auditoria
      </Text>
      <AccessEvents />
    </div>
  );
}
