// Il modulo di esempio di Rete a catenella: una ragnatela inventata, generata qui. Nessun disegno di cliente: il repo è pubblico.
// Sta su una griglia di nodi spostati a caso, ma i nodi si ripetono da un modulo all'altro: è così che i moduli si attaccano.
// La cucitura segue un cammino che passa da tutte le linee: la prima volta che ci passa è una catenella, ripassandoci è un passaggio.
import type { ModuloRete, OggettoModulo, Xy } from './motore';

const COLONNE = 8, RIGHE = 4, CELLA = 12.5, PASSO_X = COLONNE * CELLA, PASSO_Y = RIGHE * CELLA;

/** Un numero fra -1 e 1 che dipende solo dal nodo, ripetuto a ogni modulo. */
function caso(i: number, j: number, seme: number): number {
  const x = Math.sin(((i + COLONNE) % COLONNE) * 12.9898 + ((j + RIGHE) % RIGHE) * 78.233 + seme) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
const nodo = (i: number, j: number): Xy => [i * CELLA + caso(i, j, 1) * CELLA * 0.28, j * CELLA + caso(i, j, 2) * CELLA * 0.28];

export function moduloDiEsempio(): ModuloRete {
  const chiave = (i: number, j: number): string => `${i},${j}`;
  const fatte = new Set<string>();
  const oggetti: OggettoModulo[] = [];
  const cammino: Xy[] = [];
  let tratto: { tipo: 'catenella' | 'passaggio'; t: Xy[] } | null = null;
  const chiudi = (): void => { if (tratto && tratto.t.length > 1) oggetti.push({ tipo: tratto.tipo, t: tratto.t }); tratto = null; };
  const passa = (a: Xy, b: Xy, tipo: 'catenella' | 'passaggio'): void => {
    cammino.push(b);
    if (!tratto || tratto.tipo !== tipo) { chiudi(); tratto = { tipo, t: [a] }; }
    tratto.t.push(b);
  };
  const vicini = (i: number, j: number): Array<[number, number]> => [[i + 1, j], [i, j + 1], [i - 1, j], [i, j - 1]];
  const visitati = new Set<string>();
  const visita = (i: number, j: number): void => {
    visitati.add(chiave(i, j));
    const qui = nodo(i, j);
    for (const [u, v] of vicini(i, j)) {
      if (u < 0 || v < 0 || u > COLONNE || v > RIGHE) continue;
      const linea = i + j < u + v ? `${chiave(i, j)}-${chiave(u, v)}` : `${chiave(u, v)}-${chiave(i, j)}`;
      if (fatte.has(linea)) continue;
      fatte.add(linea);
      const la = nodo(u, v);
      passa(qui, la, 'catenella');
      if (!visitati.has(chiave(u, v))) visita(u, v);
      passa(la, qui, 'passaggio');
    }
  };
  cammino.push(nodo(0, 0));
  visita(0, 0);
  chiudi();
  const andata = cammino;
  const basi: OggettoModulo[] = [
    { tipo: 'base', passata: 1, t: andata },
    { tipo: 'base', passata: 2, t: [...andata].reverse() },
    { tipo: 'base', passata: 3, t: andata },
  ];
  const variante = { oggetti: [...basi, ...oggetti] };
  return {
    formato: 'rete-modulo-1', nome: 'Modulo di esempio',
    passi: { colonne: PASSO_X, righe: PASSO_Y },
    varianti: { A: variante, B: variante },
  };
}
