// What the autocomplete offers (estilos.md §8, "Editor de fórmula"), without Monaco: the provider in language.ts only maps
// these descriptions to Monaco items. Symbols and functions come from the API; nothing here knows the language rules.
import type { FormulaContext, FormulaFunction, FormulaSymbol } from './queries';

/** Category of the block the symbol comes from: the colour of its square (estilos.md §2.4). */
export type SymbolCategory = 'source' | 'multi' | 'calc' | 'decision';

export interface SymbolCompletion {
  type: 'symbol';
  /** The variable name, as shown. */
  label: string;
  /** What goes into the formula: a multiple field or list gets `[]` glued to the name. */
  insertText: string;
  /** The type, as on the block ports (`decimal(2)`, `texto`, `lista`). */
  typeLabel: string;
  /** Where it comes from, in words: the square colour is never the only signal (estilos.md §11). */
  originLabel: string;
  category: SymbolCategory;
}

export interface FunctionCompletion {
  type: 'function';
  /** The canonical name (`MÍN`). */
  label: string;
  /** The other names accepted (`MIN`): typing them also finds the function. */
  aliases: string[];
  /** Every signature of the name (`MÍN(a, b, …)` and `MÍN(lista[])`). */
  signatures: string[];
  /** One line per signature: the signature and its rule. */
  documentation: string;
}

export type Completion = SymbolCompletion | FunctionCompletion;

const DATA_TYPE_LABEL: Record<string, string> = {
  text: 'texto',
  integer: 'inteiro',
  decimal: 'decimal',
  date: 'data',
  datetime: 'data e hora',
  boolean: 'booleano',
};

/** The category of a symbol: linear input, multiple input (the list and its fields), Calculation or Decision Table. */
export function categoryOf(symbol: FormulaSymbol): SymbolCategory {
  if (symbol.origin === 'calculation') return 'calc';
  if (symbol.origin === 'decision_table') return 'decision';
  return symbol.cardinality === 'multiple' ? 'multi' : 'source';
}

/** The type as written on the block ports: `decimal(2)`, `inteiro`; a whole list is `lista`. */
export function typeLabelOf(symbol: FormulaSymbol): string {
  if (symbol.type === null) return 'lista';
  const name = DATA_TYPE_LABEL[symbol.type] ?? symbol.type;
  return symbol.type === 'decimal' && symbol.scale !== null ? `${name}(${symbol.scale})` : name;
}

function originLabelOf(symbol: FormulaSymbol): string {
  if (symbol.origin === 'calculation') return 'Cálculo';
  if (symbol.origin === 'decision_table') return 'Tabela de Decisão';
  if (symbol.cardinality === 'linear') return 'Entrada';
  return symbol.list === null ? 'Entrada múltipla' : `Campo de ${symbol.list}`;
}

/**
 * The autocomplete items: the symbols (multiple ones complete with `[]`), then the functions allowed in `context`, one item
 * per name (the scalar and the aggregation of `MÍN` are the same name).
 */
export function buildCompletions(symbols: readonly FormulaSymbol[], functions: readonly FormulaFunction[], context: FormulaContext): Completion[] {
  const symbolItems: SymbolCompletion[] = symbols.map((symbol) => ({
    type: 'symbol',
    label: symbol.name,
    insertText: symbol.cardinality === 'multiple' ? `${symbol.name}[]` : symbol.name,
    typeLabel: typeLabelOf(symbol),
    originLabel: originLabelOf(symbol),
    category: categoryOf(symbol),
  }));

  const byName = new Map<string, FunctionCompletion>();
  for (const fn of functions) {
    if (!fn.contexts.includes(context)) continue;
    const item = byName.get(fn.name) ?? { type: 'function', label: fn.name, aliases: [], signatures: [], documentation: '' };
    for (const alias of fn.aliases) if (!item.aliases.includes(alias)) item.aliases.push(alias);
    item.signatures.push(fn.signature);
    item.documentation = [item.documentation, `${fn.signature}: ${fn.description}`].filter(Boolean).join('\n\n');
    byName.set(fn.name, item);
  }

  return [...symbolItems, ...byName.values()];
}
