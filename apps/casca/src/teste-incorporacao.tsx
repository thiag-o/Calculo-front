// Página de teste de incorporação (só uso local; não entra no build de produção).
// Faz o papel do backend de um hospedeiro: troca a chave de API por um token e monta <FluxoCalculo token> ou, para
// testar o uso avulso, só a tela <Administracao token> (raiz, API e cache próprios; navegação em memória).
import { Administracao, FluxoCalculo } from '@fluxo/react';
import '@fluxo/react/estilos.css';
import { StrictMode, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { apiUrl } from './ambiente';

type Estado =
  | { fase: 'inicio' }
  | { fase: 'trocando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; token: string };

async function trocarChave(chave: string, corpo: object): Promise<Estado> {
  try {
    const resposta = await fetch(`${apiUrl}/v1/incorporacao/sessoes`, {
      method: 'POST',
      headers: { Authorization: `Chave ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados: unknown = await resposta.json().catch(() => null);
    if (resposta.status === 201 && dados && typeof dados === 'object' && 'token' in dados) {
      return { fase: 'pronto', token: String(dados.token) };
    }
    const codigo = dados && typeof dados === 'object' && 'codigo' in dados ? String(dados.codigo) : '';
    return { fase: 'erro', mensagem: `A API respondeu ${resposta.status}${codigo ? ` (${codigo})` : ''}.` };
  } catch {
    return { fase: 'erro', mensagem: `Não foi possível falar com a API em ${apiUrl}.` };
  }
}

const CAMPO = { display: 'block', width: '100%' } as const;

/** O que a página monta com o token: o módulo inteiro ou só a tela Administração, avulsa. */
type Montagem = 'modulo' | 'administracao';

function Pagina() {
  const [estado, setEstado] = useState<Estado>({ fase: 'inicio' });
  const [montagem, setMontagem] = useState<Montagem>('modulo');
  const [chave, setChave] = useState('');
  const [email, setEmail] = useState('teste@hospedeiro.local');
  const [nome, setNome] = useState('Pessoa de Teste');
  const [papeis, setPapeis] = useState('');

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEstado({ fase: 'trocando' });
    setEstado(
      await trocarChave(chave.trim(), {
        id_externo: 'teste-local',
        email: email.trim(),
        nome: nome.trim(),
        papeis: papeis
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== ''),
      }),
    );
  }

  const trocando = estado.fase === 'trocando';
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <p role="note" style={{ background: '#fff4d6', border: '1px solid #d9a400', padding: 12, margin: '0 0 16px' }}>
        Página só para teste local. Em produção, quem troca a chave de API por um token é o backend do hospedeiro; a
        chave nunca vai para o navegador.
      </p>
      <form onSubmit={(e) => void enviar(e)} style={{ display: 'grid', gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>
          Chave de API
          <input
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            autoComplete="off"
            required
            style={CAMPO}
          />
        </label>
        <label>
          E-mail do usuário
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={CAMPO} />
        </label>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required style={CAMPO} />
        </label>
        <label>
          Papéis (nomes, separados por vírgula)
          <input value={papeis} onChange={(e) => setPapeis(e.target.value)} style={CAMPO} />
        </label>
        <label>
          O que montar
          <select value={montagem} onChange={(e) => setMontagem(e.target.value as Montagem)} style={CAMPO}>
            <option value="modulo">Módulo inteiro (&lt;FluxoCalculo&gt;)</option>
            <option value="administracao">Só a Administração, avulsa (&lt;Administracao&gt;)</option>
          </select>
        </label>
        <button type="submit" disabled={trocando || chave.trim() === ''}>
          {trocando ? 'Trocando…' : 'Obter token e montar'}
        </button>
        {estado.fase === 'erro' && <p role="alert">{estado.mensagem}</p>}
      </form>
      {estado.fase === 'pronto' &&
        (montagem === 'administracao' ? (
          <Administracao apiUrl={apiUrl} token={estado.token} onSessaoExpirada={() => setEstado({ fase: 'inicio' })} />
        ) : (
          <FluxoCalculo
            apiUrl={apiUrl}
            token={estado.token}
            navegacao="memoria"
            onSessaoExpirada={() => setEstado({ fase: 'inicio' })}
          />
        ))}
    </main>
  );
}

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em teste-incorporacao.html.');
createRoot(raiz).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
