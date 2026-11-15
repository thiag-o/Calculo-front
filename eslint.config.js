// Fronteiras entre verticais do @fluxo/react (ADR 0003).
// Esqueleto: as dependências (eslint, typescript-eslint, eslint-plugin-boundaries)
// são instaladas na fase 1; a configuração deve ser validada nesse momento.
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const src = 'packages/react/src';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  ...tseslint.configs.recommended,
  {
    files: [`${src}/**/*.{ts,tsx}`],
    plugins: { boundaries },
    settings: {
      // A ordem importa: o primeiro padrão que casa define o tipo.
      'boundaries/elements': [
        { type: 'raiz', pattern: `${src}/index.ts`, mode: 'file' },
        { type: 'design-system', pattern: `${src}/design-system` },
        { type: 'api', pattern: `${src}/api` },
        { type: 'vertical', pattern: `${src}/*`, capture: ['nome'] },
      ],
    },
    rules: {
      // De fora, uma vertical só é acessada pelo index.ts dela (interface pública).
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          rules: [{ target: ['design-system', 'api', 'vertical'], allow: 'index.ts' }],
        },
      ],
      // Quem pode depender de quem.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'raiz', allow: ['design-system', 'api', 'vertical'] },
            { from: 'vertical', allow: ['design-system', 'api', 'vertical'] },
            { from: 'api', allow: [] },
            { from: 'design-system', allow: [] },
          ],
        },
      ],
      // Arquivos fora de uma vertical não são permitidos em src/.
      'boundaries/no-unknown-files': 'error',
    },
  },
);
