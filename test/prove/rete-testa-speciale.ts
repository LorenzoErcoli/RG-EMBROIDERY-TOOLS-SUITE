import { costruisciRete, stratiRete, PARAMETRI_RETE } from '../../apps/rete-testa-speciale/src/motore';

// Un davanti con lo scollo e un vuoto tondo al centro (la forma della simulazione decisa con Lorenzo), coi valori di partenza.
export async function prova() {
  const contorno = [{ x: 0, y: 25 }, { x: 38, y: 0 }];
  for (let i = 1; i < 24; i++) contorno.push({ x: 38 + 64 * i / 24, y: 40 * Math.sin(Math.PI * i / 24) });
  contorno.push({ x: 102, y: 0 }, { x: 140, y: 25 }, { x: 136, y: 185 }, { x: 4, y: 185 });
  const vuoti = [Array.from({ length: 96 }, (_, i) => ({ x: 70 + 24 * Math.cos(i / 96 * 2 * Math.PI), y: 108 + 24 * Math.sin(i / 96 * 2 * Math.PI) }))];
  const params = { ...PARAMETRI_RETE };
  return {
    ingresso: { contorno, vuoti },
    params,
    // la strada di prima: la chiamata di tool.ts e lo strato di stratiRete()
    diretto: () => stratiRete(costruisciRete(contorno, vuoti, params)),
  };
}
