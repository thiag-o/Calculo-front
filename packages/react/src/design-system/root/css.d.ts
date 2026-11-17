// CSS imports (Vite extracts them into the package styles.css). No dependency on the Vite types.
declare module '*.css';

// CSS content as text (`?raw`), used in tests to apply the stylesheets in jsdom.
declare module '*.css?raw' {
  const content: string;
  export default content;
}
