// Validação da origem de um domínio autorizado no cliente, no formato do contrato: `https?://host[:porta]`, sem
// caminho, consulta nem fragmento. A API valida de novo (`422 origem_invalida`) e normaliza (minúsculas, sem barra
// final, sem a porta padrão); aqui só se evita a ida e volta nos erros comuns.

export const MENSAGEM_ORIGEM_VAZIA = 'Informe a origem';
export const MENSAGEM_ORIGEM_SEM_ESQUEMA = 'Comece com https:// ou http://, como https://app.exemplo.com.br';
export const MENSAGEM_ORIGEM_COM_CAMINHO = 'Tire o caminho, a consulta e o fragmento: só https://host e, se precisar, :porta';
export const MENSAGEM_ORIGEM_HOST_INVALIDO = 'Confira o host e a porta, como https://app.exemplo.com.br:8443';

// Esquema, autoridade (sem espaço, "/", "?", "#" nem "@") e, no máximo, uma barra final.
const FORMATO = /^https?:\/\/[^\s/?#@]+\/?$/i;

/** O motivo de a origem ser inválida, ou `undefined` se ela segue `https?://host[:porta]`. */
export function problemaDaOrigem(valor: string): string | undefined {
  const origem = valor.trim();
  if (origem === '') return MENSAGEM_ORIGEM_VAZIA;
  if (!/^https?:\/\//i.test(origem)) return MENSAGEM_ORIGEM_SEM_ESQUEMA;
  const autoridade = origem.replace(/^https?:\/\//i, '');
  if (/[/?#]/.test(autoridade.replace(/\/$/, ''))) return MENSAGEM_ORIGEM_COM_CAMINHO;
  if (!FORMATO.test(origem)) return MENSAGEM_ORIGEM_HOST_INVALIDO;
  let url: URL;
  try {
    url = new URL(origem);
  } catch {
    return MENSAGEM_ORIGEM_HOST_INVALIDO;
  }
  // A porta, se vier, precisa ser só dígitos (o URL aceitaria ":" vazio).
  if (url.hostname === '' || /:$/.test(autoridade.replace(/\/$/, ''))) return MENSAGEM_ORIGEM_HOST_INVALIDO;
  return undefined;
}
