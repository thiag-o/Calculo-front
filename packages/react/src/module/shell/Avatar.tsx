/** Initials of a name: the first letter of the first and of the last word ("Ana Beatriz" → "AB"). */
export function initial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('pt-BR');
}

/** Avatar (estilos.md §7.7): circle with the initials, no status color. Decorative: the name is next to it. */
export function Avatar({ name, tone }: { name: string; tone: 'neutral' | 'strong' }) {
  return (
    <span className={`fc-module-avatar fc-module-avatar-${tone}`} aria-hidden="true">
      {initial(name)}
    </span>
  );
}
