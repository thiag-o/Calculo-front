// Who is who in the lists of the properties (inputs, fields of a Múltiplo, output fields), by object and not by position
// (ADR 0044). The edits keep the objects of what did not change; an edited item passes its key to the object that replaces
// it. So a moved, included or removed item keeps its React key, its problems (found in the analysed definition) and its
// merge key, even while the analysis of the latest change is on the way.

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

/**
 * Where the item is in `list`: the same object or an edited version of it (the same key). `-1` when it is not there (it
 * was included after `list`, or removed).
 */
export function indexOfItem<T extends object>(list: readonly T[] | undefined, item: T): number {
  if (!list) return -1;
  const same = list.indexOf(item);
  if (same >= 0) return same;
  const key = keys.get(item);
  if (key === undefined) return -1;
  return list.findIndex((candidate) => keys.get(candidate) === key);
}
