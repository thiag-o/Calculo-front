/** Iniciais de um nome: a primeira letra da primeira e da última palavra ("Ana Beatriz" → "AB"). */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = palavras[0]?.[0] ?? '';
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}

/** Avatar (estilos.md §7.7): círculo com as iniciais, sem cor de status. Decorativo: o nome está ao lado. */
export function Avatar({ nome, tom }: { nome: string; tom: 'neutro' | 'forte' }) {
  return (
    <span className={`fc-modulo-avatar fc-modulo-avatar-${tom}`} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}
