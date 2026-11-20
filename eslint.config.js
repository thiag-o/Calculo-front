// Boundaries between the @fluxo/react verticals (ADR 0003), with eslint-plugin-boundaries v7.
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const src = 'packages/react/src';

// Type folders: forbidden at any level, including inside a vertical (ADR 0003).
const typeFolders = ['components', 'hooks', 'types', 'utils', 'helpers', 'lib', 'shared', 'common'];

// Patterns of an element up to 6 folder levels deep, none of them a type folder.
// Whatever is left out (a type folder at any level) matches no element and falls into boundaries/no-unknown-files.
const notByType = `!(${typeFolders.join('|')})`;
function elementsOf(type, folder, capture) {
  return Array.from({ length: 6 }, (_, levels) => ({
    type,
    pattern: `${src}/${folder}/${Array(levels).fill(notByType).map((p) => p + '/').join('')}*`,
    mode: 'full',
    ...(capture ? { capture } : {}),
  }));
}

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/generated/**'] },
  ...tseslint.configs.recommended,
  {
    // Hook rules only (not the React Compiler rules of the plugin's recommended preset).
    files: ['packages/react/src/**/*.{ts,tsx}', 'apps/shell/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: [`${src}/**/*.{ts,tsx}`],
    plugins: { boundaries },
    settings: {
      // Resolves imports without extension (like Vite and tsc), so the boundaries see the target file.
      'import/resolver': { typescript: { project: ['packages/react/tsconfig.json'] } },
      // The first type that matches defines the file's element.
      'boundaries/elements': [
        { type: 'root', pattern: `${src}/index.ts`, mode: 'file' },
        ...elementsOf('design-system', 'design-system'),
        ...elementsOf('api', 'api'),
        ...elementsOf('vertical', '*', ['name']),
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Between elements, only through the public interface of design-system, api and verticals: the index.ts at their
            // ROOT (ADR 0003). Each file is an element of its own, so the index.ts of a subfolder also has
            // fileInternalPath 'index.ts'; that is why the filter is by the element path, fixed at the first level.
            {
              from: { element: { type: ['root', 'vertical'] } },
              allow: { to: { element: { type: ['design-system', 'api', 'vertical'], path: `${src}/*/index.{ts,tsx}` } } },
            },
            // Inside the same element the organization is free (ADR 0003): internal imports are allowed.
            // Each file is an element of its own (patterns end in `*`), so the rule must say so.
            { from: { element: { type: 'design-system' } }, allow: { to: { element: { type: 'design-system' } } } },
            { from: { element: { type: 'api' } }, allow: { to: { element: { type: 'api' } } } },
            {
              from: { element: { type: 'vertical' } },
              allow: { to: { element: { type: 'vertical', captured: { name: '{{ from.element.captured.name }}' } } } },
            },
            // design-system and api import nobody.
            { from: { element: { type: ['design-system', 'api'] } }, disallow: { to: { element: { type: ['root', 'vertical'] } } } },
          ],
        },
      ],
      // A file inside src/ that belongs to no element (including a type folder) is an error.
      'boundaries/no-unknown-files': 'error',
    },
  },
);
