import { dstFromExportLayers } from '../../packages/core/src/index';
import { costruisciRete, stratiRete, PARAMETRI_RETE, type Xy } from '../../apps/rete-catenella/src/motore';
import { moduloDiEsempio } from '../../apps/rete-catenella/src/esempio';

// Un trapezio inventato, riempito col modulo di esempio, coi valori di partenza. Il modulo vero di un cliente non sta nel repo.
export async function prova() {
  const anello: Xy[] = [[10, 10], [310, 10], [260, 210], [60, 210], [10, 10]];
  const params = { ...PARAMETRI_RETE };
  return {
    ingresso: { sagoma: [{ points: anello.map(([x, y]) => ({ x, y })), closed: true, color: '#000000' }] },
    params,
    // il DST che il tool esporta: senza centrarlo, il ricamo resta dove sta sul contorno
    dst: () => dstFromExportLayers(stratiRete(costruisciRete(moduloDiEsempio(), anello.slice(0, 4), params)), { center: false, label: 'RETE-CATENELLA' }),
    diretto: () => stratiRete(costruisciRete(moduloDiEsempio(), anello.slice(0, 4), params)),
  };
}
