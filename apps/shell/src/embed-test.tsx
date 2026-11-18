// Embed test page (local use only; not part of the production build).
// Plays the host app backend: exchanges the API key for a token and mounts <FluxoCalculo token> or, to
// test standalone use, only the <Admin token> or <Catalog token> screen (own root, API and cache; in-memory navigation).
import { Admin, Catalog, FluxoCalculo } from '@fluxo/react';
import '@fluxo/react/styles.css';
import { StrictMode, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { apiUrl } from './environment';
import './embed-test.css';

type State =
  | { phase: 'home' }
  | { phase: 'switching' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; token: string };

async function exchangeApiKey(apiKey: string, body: object): Promise<State> {
  try {
    const response = await fetch(`${apiUrl}/v1/embed/sessions`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.status === 201 && data && typeof data === 'object' && 'token' in data) {
      return { phase: 'ready', token: String(data.token) };
    }
    const code = data && typeof data === 'object' && 'code' in data ? String(data.code) : '';
    return { phase: 'error', message: `A API respondeu ${response.status}${code ? ` (${code})` : ''}.` };
  } catch {
    return { phase: 'error', message: `Não foi possível falar com a API em ${apiUrl}.` };
  }
}

/** What the page mounts with the token: the whole module or only the standalone Admin or Catalog screen. */
type Mount = 'module' | 'admin' | 'catalog';

function EmbedTestPage() {
  const [state, setState] = useState<State>({ phase: 'home' });
  const [mount, setMount] = useState<Mount>('module');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('teste@hospedeiro.local');
  const [name, setName] = useState('Pessoa de Teste');
  const [roles, setRoles] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ phase: 'switching' });
    setState(
      await exchangeApiKey(apiKey.trim(), {
        external_id: 'teste-local',
        email: email.trim(),
        name: name.trim(),
        roles: roles
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== ''),
      }),
    );
  }

  const switching = state.phase === 'switching';
  return (
    <main className="fc-root embed-test">
      <p role="note" className="embed-test-note">
        Página só para teste local. Em produção, quem troca a chave de API por um token é o backend do hospedeiro; a
        chave nunca vai para o navegador.
      </p>
      <form onSubmit={(e) => void submit(e)} className="embed-test-form">
        <label>
          Chave de API
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            required
            className="embed-test-field"
          />
        </label>
        <label>
          E-mail do usuário
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="embed-test-field"
          />
        </label>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} required className="embed-test-field" />
        </label>
        <label>
          Papéis (nomes, separados por vírgula)
          <input value={roles} onChange={(e) => setRoles(e.target.value)} className="embed-test-field" />
        </label>
        <label>
          O que montar
          <select value={mount} onChange={(e) => setMount(e.target.value as Mount)} className="embed-test-field">
            <option value="module">Módulo inteiro (&lt;FluxoCalculo&gt;)</option>
            <option value="admin">Só a Administração, avulsa (&lt;Admin&gt;)</option>
            <option value="catalog">Só o Catálogo, avulso (&lt;Catalog&gt;)</option>
          </select>
        </label>
        <button type="submit" disabled={switching || apiKey.trim() === ''}>
          {switching ? 'Trocando…' : 'Obter token e montar'}
        </button>
        {state.phase === 'error' && (
          <p role="alert" className="embed-test-error">
            {state.message}
          </p>
        )}
      </form>
      {state.phase === 'ready' &&
        (mount === 'admin' ? (
          <Admin apiUrl={apiUrl} token={state.token} onSessionExpired={() => setState({ phase: 'home' })} />
        ) : mount === 'catalog' ? (
          <Catalog apiUrl={apiUrl} token={state.token} onSessionExpired={() => setState({ phase: 'home' })} />
        ) : (
          <FluxoCalculo
            apiUrl={apiUrl}
            token={state.token}
            navigation="memory"
            onSessionExpired={() => setState({ phase: 'home' })}
          />
        ))}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado em embed-test.html.');
createRoot(root).render(
  <StrictMode>
    <EmbedTestPage />
  </StrictMode>,
);
