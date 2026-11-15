// Importações de CSS (o Vite as extrai para o estilos.css do pacote). Sem dependência dos tipos do Vite.
declare module '*.css';

// Conteúdo do CSS como texto (`?raw`), usado nos testes para aplicar as folhas no jsdom.
declare module '*.css?raw' {
  const conteudo: string;
  export default conteudo;
}
