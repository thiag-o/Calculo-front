export const DEFAULT_SHELL_PORT: number;
export const DEFAULT_HOST_APP_PORT: number;
export const ISOLATED_PORT_MIN: number;
export const ISOLATED_PORT_MAX: number;
export function e2ePorts(env?: Record<string, string | undefined>): { shellPort: number; hostAppPort: number };
