import { PARAMETRI_MAGLIA, cuci, strati, type Tratto } from '../../apps/punto-maglia/src/motore';

// Una «D» semplice: la gamba dritta (centro 2) e l'arco (centro 1,5) che le passa sopra in cima e in fondo,
// più un anello (centro 1) a parte.
export async function prova() {
  const T = (nome: string, punti: Array<[number, number]>, o: Partial<Tratto> = {}): Tratto =>
    ({ nome, punti, chiuso: false, colonne: 1, versoV: 'avanti', inizio: 'capo', mezza: 'destra', ...o });
  const tratti: Tratto[] = [
    T('gamba', [[20, 5], [20, 45], [20, 85]], { colonne: 2 }),
    T('arco', [[5, 12], [45, 12], [75, 45], [45, 80], [5, 80]], { colonne: 1.5 }),
    T('o', [[100, 50], [110, 60], [100, 70], [90, 60]], { chiuso: true }),
  ];
  const params = { ...PARAMETRI_MAGLIA };
  return { ingresso: { tratti }, params, diretto: () => strati(cuci(tratti, params)) };
}
