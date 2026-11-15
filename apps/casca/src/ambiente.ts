// Variáveis de ambiente do casca (toda VITE_* vai para o navegador: nunca segredo).
export const apiUrl: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const ambiente: string = (import.meta.env.VITE_AMBIENTE ?? '').trim();

const ROTULOS: Record<string, string> = { local: 'Local', homologacao: 'Homologação' };

/** Rótulo do ambiente, ou `null` em produção (ou sem a variável definida). */
export const rotuloAmbiente: string | null =
  ambiente === '' || ambiente === 'producao' ? null : (ROTULOS[ambiente] ?? ambiente);
