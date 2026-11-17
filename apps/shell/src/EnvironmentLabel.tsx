import { environmentLabel } from './environment';

/** Fixed tag with the environment name; hidden in production. */
export function EnvironmentLabel() {
  if (environmentLabel === null) return null;
  return (
    <div
      role="status"
      aria-label={`Ambiente: ${environmentLabel}`}
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 1000,
        padding: '2px 8px',
        borderRadius: 6,
        font: '500 12px/20px system-ui, sans-serif',
        color: '#fff',
        background: '#6b6f76',
        pointerEvents: 'none',
      }}
    >
      {environmentLabel}
    </div>
  );
}
