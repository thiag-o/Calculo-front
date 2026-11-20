import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, MERGE_WINDOW_MS, pushHistory, redoHistory, startHistory, undoHistory } from './history';

describe('Histórico do desfazer', () => {
  it('desfaz e refaz na ordem, e não passa das pontas', () => {
    let history = startHistory('a');
    history = pushHistory(history, 'b', 0);
    history = pushHistory(history, 'c', 5000);
    history = undoHistory(history);
    expect(history.present).toBe('b');
    history = undoHistory(history);
    expect(history.present).toBe('a');
    expect(undoHistory(history)).toBe(history);
    history = redoHistory(redoHistory(history));
    expect(history.present).toBe('c');
    expect(redoHistory(history)).toBe(history);
  });

  it('guarda no máximo 50 passos', () => {
    let history = startHistory(0);
    for (let step = 1; step <= 60; step++) history = pushHistory(history, step, step * 10_000);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    for (let step = 0; step < 60; step++) history = undoHistory(history);
    expect(history.present).toBe(10);
  });

  it('uma mudança nova depois de desfazer descarta o refazer', () => {
    let history = pushHistory(startHistory('a'), 'b', 0);
    history = undoHistory(history);
    history = pushHistory(history, 'x', 5000);
    expect(history.future).toHaveLength(0);
    expect(redoHistory(history)).toBe(history);
    expect(undoHistory(history).present).toBe('a');
  });

  it('junta mudanças da mesma chave dentro de 1 s, e separa fora dessa janela ou com outra chave', () => {
    let history = startHistory('');
    history = pushHistory(history, 'v', 0, 'formula');
    history = pushHistory(history, 'va', 300, 'formula');
    history = pushHistory(history, 'val', 600, 'formula');
    expect(history.past).toEqual(['']);
    history = pushHistory(history, 'valo', 600 + MERGE_WINDOW_MS, 'formula');
    expect(history.past).toEqual(['', 'val']);
    history = pushHistory(history, 'nome', 600 + MERGE_WINDOW_MS + 10, 'name');
    expect(history.past).toEqual(['', 'val', 'valo']);
    // Without a key, each change is a step.
    history = pushHistory(pushHistory(history, 'n1', 2000), 'n2', 2001);
    expect(history.past.slice(-2)).toEqual(['nome', 'n1']);
  });

  it('o mesmo valor não vira passo', () => {
    const history = startHistory('a');
    expect(pushHistory(history, 'a', 0)).toBe(history);
  });
});
