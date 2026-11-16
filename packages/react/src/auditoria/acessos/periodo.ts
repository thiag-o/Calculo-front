// Período do filtro: "De" e "Até" vêm do calendário do navegador (`aaaa-mm-dd`) e viram instantes no fuso de quem
// usa. O `desde` da API é inclusivo e o `ate` é exclusivo, então "Até" vira o início do dia seguinte: o último dia
// entra inteiro (resposta D3 da F18).

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O início do dia (`aaaa-mm-dd`) no fuso local, somando `dias`; `undefined` se o dia não existir. */
function inicioDoDiaLocal(dia: string, dias = 0): Date | undefined {
  const partes = FORMATO_DIA.exec(dia);
  if (!partes) return undefined;
  const [ano, mes, numero] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(ano, mes - 1, numero);
  // Recusa dias que o Date "conserta" (31/02 vira 03/03).
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== numero) return undefined;
  data.setDate(data.getDate() + dias);
  return data;
}

/** Se o valor é um dia completo e válido (`aaaa-mm-dd`). */
export function diaValido(dia: string): boolean {
  return inicioDoDiaLocal(dia) !== undefined;
}

/** `desde` da API: o início do dia "De", no fuso local, em ISO 8601. */
export function desdeDe(dia: string): string | undefined {
  return inicioDoDiaLocal(dia)?.toISOString();
}

/** `ate` da API (exclusivo): o início do dia seguinte ao "Até", no fuso local, em ISO 8601. */
export function ateDe(dia: string): string | undefined {
  return inicioDoDiaLocal(dia, 1)?.toISOString();
}

/** Se "De" vem depois de "Até" (os dois preenchidos). O mesmo dia nos dois é um período de um dia. */
export function periodoInvertido(de: string, ate: string): boolean {
  return diaValido(de) && diaValido(ate) && de > ate;
}
