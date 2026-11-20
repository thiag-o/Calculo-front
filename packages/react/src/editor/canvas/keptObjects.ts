// Objects kept by id between renders, so React Flow (and the `memo` of the nodes) sees the same node or link object while
// nothing it shows changed (ADR 0044).

/** Objects kept by id while what they are made of (`parts`) stays the same. */
export type KeptObjects<T> = Map<string, { parts: readonly unknown[]; value: T }>;

/** The kept object of `id` when its parts are the same objects as before; otherwise a new one, kept from now on. */
export function keep<T>(cache: KeptObjects<T>, id: string, parts: readonly unknown[], make: () => T): T {
  const hit = cache.get(id);
  if (hit && hit.parts.length === parts.length && hit.parts.every((part, index) => Object.is(part, parts[index]))) return hit.value;
  const value = make();
  cache.set(id, { parts, value });
  return value;
}

/**
 * The list after an update of the kept objects: forgets the ids that are gone (a removed block, a link that no longer
 * exists), and gives back the previous list when every item is the same object as before.
 */
export function settle<T extends { id: string }>(cache: KeptObjects<T>, previous: T[] | null, next: T[]): T[] {
  const present = new Set(next.map((item) => item.id));
  for (const id of cache.keys()) if (!present.has(id)) cache.delete(id);
  if (previous && previous.length === next.length && next.every((item, index) => item === previous[index])) return previous;
  return next;
}
