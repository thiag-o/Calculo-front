// Shell environment variables (every VITE_* goes to the browser: never a secret).
export const apiUrl: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const environment: string = (import.meta.env.VITE_AMBIENTE ?? '').trim();

const LABELS: Record<string, string> = { local: 'Local', homologacao: 'Homologação' };

/** Environment label, or `null` in production (or when the variable is not set). */
export const environmentLabel: string | null =
  environment === '' || environment === 'producao' ? null : (LABELS[environment] ?? environment);
