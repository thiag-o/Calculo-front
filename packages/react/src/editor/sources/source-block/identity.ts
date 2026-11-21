// Who is who in the lists of a Source block (links, filters, ordering, outputs), by object and not by position (ADR 0044).
// The edits keep the objects of what did not change; an edited item passes its key to the object that replaces it. So a
// moved, included or removed item keeps its React key, its problems (found in the analysed definition) and its merge key,
// even while the analysis of the latest change is on the way. The same pattern as the properties' (ADR 0047: each
// sub-vertical keeps its own WeakMap).

const keys = new WeakMap<object, number>();
let lastKey = 0;

/** The key of the item: the same for the object and for every edited version of it. */
export function itemKey(item: object): number {
  let key = keys.get(item);
  if (key === undefined) {
    lastKey += 1;
    key = lastKey;
    keys.set(item, key);
  }
  return key;
}

/** `after` is the edited `before`: it takes its key. Returns `after`. */
export function replaced<T extends object>(before: object, after: T): T {
  if (after !== before && !keys.has(after)) keys.set(after, itemKey(before));
  return after;
}

/** Where the item is in `list`: the same object or an edited version of it. `-1` when it is not there. */
export function indexOfItem<T extends object>(list: readonly T[] | undefined, item: T): number {
  if (!list) return -1;
  const same = list.indexOf(item);
  if (same >= 0) return same;
  const key = keys.get(item);
  if (key === undefined) return -1;
  return list.findIndex((candidate) => keys.get(candidate) === key);
}

/** The list with `item` replaced by `update(item)`, which takes its key. The same list when nothing changed. */
export function replaceItem<T extends object>(items: readonly T[], item: T, update: (current: T) => T): T[] {
  const index = indexOfItem(items, item);
  if (index < 0) return [...items];
  const current = items[index]!;
  const next = update(current);
  const list = [...items];
  list[index] = replaced(current, next);
  return list;
}

/** The list without `item`. */
export function removeItem<T extends object>(items: readonly T[], item: T): T[] {
  const index = indexOfItem(items, item);
  return items.filter((_, position) => position !== index);
}

/** The list with `item` swapped with its neighbour (`-1` up, `+1` down). */
export function moveItem<T extends object>(items: readonly T[], item: T, offset: -1 | 1): T[] {
  const index = indexOfItem(items, item);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
