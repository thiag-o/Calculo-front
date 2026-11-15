// Fronteiras entre verticais do @fluxo/react (ADR 0003), com eslint-plugin-boundaries v7.
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const src = 'packages/react/src';

// Pastas por tipo: proibidas em qualquer nível, inclusive dentro de uma vertical (ADR 0003).
const pastasPorTipo = ['components', 'hooks', 'types', 'utils', 'helpers', 'lib', 'shared', 'common'];

// Padrões de um elemento até 6 níveis de pasta, nenhum deles uma pasta por tipo.
// O que fica fora (pasta por tipo em qualquer nível) não casa com nenhum elemento e cai em boundaries/no-unknown-files.
const naoPorTipo = `!(${pastasPorTipo.join('|')})`;
function elementosDa(type, pasta, capture) {
  return Array.from({ length: 6 }, (_, niveis) => ({
    type,
    pattern: `${src}/${pasta}/${Array(niveis).fill(naoPorTipo).map((p) => p + '/').join('')}*`,
    mode: 'full',
    ...(capture ? { capture } : {}),
  }));
}

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/gerado/**'] },
  ...tseslint.configs.recommended,
  {
    files: [`${src}/**/*.{ts,tsx}`],
    plugins: { boundaries },
    settings: {
      // Resolve imports sem extensão (como o Vite e o tsc), para as fronteiras enxergarem o arquivo de destino.
      'import/resolver': { typescript: { project: ['packages/react/tsconfig.json'] } },
      // O primeiro tipo que casa define o elemento do arquivo.
      'boundaries/elements': [
        { type: 'raiz', pattern: `${src}/index.ts`, mode: 'file' },
        ...elementosDa('design-system', 'design-system'),
        ...elementosDa('api', 'api'),
        ...elementosDa('vertical', '*', ['nome']),
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Entre elementos, só pela interface pública (index.ts) de design-system, api e verticais.
            {
              from: { element: { type: ['raiz', 'vertical'] } },
              allow: { to: { element: { type: ['design-system', 'api', 'vertical'], fileInternalPath: 'index.{ts,tsx}' } } },
            },
            // Dentro do mesmo elemento a organização é livre (ADR 0003): imports internos são permitidos.
            // Cada arquivo é um elemento próprio (padrões terminam em `*`), então a regra precisa dizer isso.
            { from: { element: { type: 'design-system' } }, allow: { to: { element: { type: 'design-system' } } } },
            { from: { element: { type: 'api' } }, allow: { to: { element: { type: 'api' } } } },
            {
              from: { element: { type: 'vertical' } },
              allow: { to: { element: { type: 'vertical', captured: { nome: '{{ from.element.captured.nome }}' } } } },
            },
            // design-system e api não importam ninguém.
            { from: { element: { type: ['design-system', 'api'] } }, disallow: { to: { element: { type: ['raiz', 'vertical'] } } } },
          ],
        },
      ],
      // Arquivo dentro de src/ que não é de nenhum elemento (inclui pasta por tipo) é erro.
      'boundaries/no-unknown-files': 'error',
    },
  },
);
