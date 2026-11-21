// Texts of the groups on screen (pt-BR).

/** The name of a new group: "Grupo 1", "Grupo 2"… */
export const GROUP_NAME = 'Grupo';

/** The labels of the group actions (estilos §13: one label per intention). */
export const GROUP_ACTION = 'Agrupar';
export const UNGROUP_ACTION = 'Desagrupar';
export const MOVE_TO_GROUP_ACTION = 'Mover para o grupo…';
export const TAKE_OUT_OF_GROUP_ACTION = 'Tirar do grupo';
export const COLLAPSE_ACTION = 'Recolher grupo';
export const EXPAND_ACTION = 'Expandir grupo';

/** Why Agrupar is disabled. */
export const NOTHING_TO_GROUP_REASON = 'Selecione os blocos com Shift + clique ou com o laço (Shift + arrastar)';
export const SAME_GROUP_REASON = 'Os blocos precisam estar no mesmo grupo para agrupar';
/** Why "Mover para o grupo…" is disabled. */
export const NO_TARGET_GROUP_REASON = 'Não há outro grupo para onde mover';
/** Why "Tirar do grupo" is disabled. */
export const NOT_IN_GROUP_REASON = 'O bloco não está dentro de um grupo';
/** Why Desagrupar is disabled. */
export const NOT_A_GROUP_REASON = 'Só um grupo pode ser desagrupado';

/** "1 bloco", "3 blocos": the count in the group header (the blocks at any depth inside it). */
export function blockCountText(count: number): string {
  return count === 1 ? '1 bloco' : `${count.toLocaleString('pt-BR')} blocos`;
}

/** The tooltip and the accessible text of the derived Input. */
export const DERIVED_INPUT_TEXT = 'Derivado da análise: as variáveis de fora que os blocos do grupo usam';

/** The announcements after a group action. */
export function groupedText(name: string, count: number): string {
  return `${blockCountText(count)} no grupo ${name}`;
}

export function ungroupedText(name: string): string {
  return `Grupo ${name} desfeito`;
}

export function movedToGroupText(block: string, group: string): string {
  return `${block} movido para o grupo ${group}`;
}

export function takenOutText(block: string, group: string): string {
  return `${block} tirado do grupo ${group}`;
}

export function collapsedText(name: string, collapsed: boolean): string {
  return collapsed ? `Grupo ${name} recolhido` : `Grupo ${name} expandido`;
}

/** The announcement of the multiple selection (Shift + clique, Shift + Espaço or the lasso). */
export function pickedText(count: number): string {
  if (count === 0) return 'Nenhum bloco selecionado para agrupar';
  return count === 1 ? '1 bloco selecionado para agrupar' : `${count.toLocaleString('pt-BR')} blocos selecionados para agrupar`;
}

/** "1 problema", "3 problemas". */
export function groupProblemsText(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The accessible name of a group on the canvas: "Pontuação, Grupo, 2 blocos, recolhido, 1 problema". */
export function groupLabel(name: string, blocks: number, collapsed: boolean, problems: number): string {
  return [name, GROUP_NAME, blockCountText(blocks), collapsed ? 'recolhido' : null, problems > 0 ? groupProblemsText(problems) : null]
    .filter(Boolean)
    .join(', ');
}
