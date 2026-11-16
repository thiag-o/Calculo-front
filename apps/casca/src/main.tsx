// Ponto de entrada do app casca (hospedeiro zero, ADR 0002).
// A casca não tem regra de negócio: o login e o produto vivem em @fluxo/react.
import { Entrar, FluxoCalculo, RedefinirSenha } from '@fluxo/react';
import '@fluxo/react/estilos.css';
import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiUrl } from './ambiente';
import { RotuloAmbiente } from './RotuloAmbiente';

const ROTA_ENTRAR = '/entrar';
const ROTA_INICIAL = '/inicio';
const ROTA_REDEFINIR = '/redefinir';

// Rota pública /redefinir?token=...: o token do link de redefinição vem da URL.
function naRotaRedefinir(): boolean {
  return window.location.pathname === ROTA_REDEFINIR;
}

function tokenDoLink(): string {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

function naRotaEntrar(): boolean {
  return window.location.pathname === ROTA_ENTRAR;
}

function irPara(caminho: string) {
  window.history.pushState(null, '', caminho);
}

function Casca() {
  const [entrando, setEntrando] = useState(naRotaEntrar);
  const [redefinindo, setRedefinindo] = useState(naRotaRedefinir);
  const [tokenLink] = useState(tokenDoLink);

  // Senha salva: segue para o login.
  const aoRedefinir = useCallback(() => {
    irPara(ROTA_ENTRAR);
    setRedefinindo(false);
    setEntrando(true);
  }, []);

  // Depois do login a URL vira /inicio e o módulo (modo url, basename "/") assume a navegação.
  const aoEntrar = useCallback(() => {
    irPara(ROTA_INICIAL);
    setEntrando(false);
  }, []);

  // Sessão expirada ou "Sair" (ADR 0019): volta ao login.
  const aoEncerrar = useCallback(() => {
    irPara(ROTA_ENTRAR);
    setEntrando(true);
  }, []);

  return (
    <>
      {redefinindo ? (
        <RedefinirSenha apiUrl={apiUrl} token={tokenLink} onSalvar={aoRedefinir} />
      ) : entrando ? (
        <Entrar apiUrl={apiUrl} onEntrar={aoEntrar} />
      ) : (
        <FluxoCalculo apiUrl={apiUrl} navegacao="url" onSessaoExpirada={aoEncerrar} />
      )}
      <RotuloAmbiente />
    </>
  );
}

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html.');
createRoot(raiz).render(
  <StrictMode>
    <Casca />
  </StrictMode>,
);
