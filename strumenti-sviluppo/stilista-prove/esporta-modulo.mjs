// Dal JSON del lettore offline a un file di modulo per Rete a catenella (`rete-modulo-1`). Il file contiene la geometria di un
// disegno di cliente: si scrive fuori dal repo, che è pubblico, e il tool lo carica col suo bottone.
//
// Uso:  node strumenti-sviluppo/stilista-prove/esporta-modulo.mjs <lettura.json> <primo oggetto della variante A> <primo oggetto della variante B> <file di uscita>
//       Le due varianti sono due moduli interi di colonne vicine, sulla stessa riga. Il passo righe e la ripetizione A → A si misurano
//       cercando le copie esatte nel file. Il passo colonne è uno solo, metà di A → A: la differenza fra le colonne del file non è voluta (Lorenzo, 2026-11-03).
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [lettura, primoA, primoB, uscita] = process.argv.slice(2);
if (!uscita) throw new Error('servono: lettura.json, primo oggetto A, primo oggetto B, file di uscita');
const dalRepo = relative(fileURLToPath(new URL('../../', import.meta.url)), resolve(uscita));
if (!dalRepo.startsWith('..') && !isAbsolute(dalRepo) && !/^strumenti-sviluppo[\\/]stilista-prove[\\/]out[\\/]/.test(dalRepo)) throw new Error('il modulo non va nel repo');
const doc = JSON.parse(readFileSync(lettura, 'utf8'));
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const psil = (o) => doc.parameter_sets[o.serialized_parameter_index].values[37] === 32;
const eCatenella = (o) => o.kind === 'running' && o.source_path.point_count < 20 && psil(o);
const ePassaggio = (o) => o.kind === 'running' && o.source_path.point_count < 20 && o.serialized_parameter_index === 1;
const eBase = (o) => o.kind === 'running' && o.source_path.point_count >= 100;
const blocco = (primo) => doc.needle_blocks.find((b) => b.first_object_index === Number(primo)) ?? (() => { throw new Error('nessun modulo comincia da ' + primo); })();
const oggettiDi = (b) => doc.objects.slice(b.first_object_index, b.last_object_index + 1);
const partenza = (b) => mm(oggettiDi(b).find(eBase).source_path.points[0]);
const tondo = (v) => Math.round(v * 1000) / 1000;

function estrai(b) {
  const zero = partenza(b);
  let n = 0;
  const oggetti = [];
  for (const o of oggettiDi(b)) {
    const t = o.source_path.points.map(mm).map((p) => [tondo(p[0] - zero[0]), tondo(p[1] - zero[1])]);
    if (eBase(o)) { n++; oggetti.push({ tipo: 'base', passata: ((n - 1) % 3) + 1, t }); } // 3 passate su ogni metà del modulo
    else if (eCatenella(o)) oggetti.push({ tipo: 'catenella', t });
    else if (ePassaggio(o) && t[0][0] > -60) oggetti.push({ tipo: 'passaggio', t }); // non il trattino fuori dal pannello
  }
  return { oggetti };
}

const A = blocco(primoA), B = blocco(primoB), pA = partenza(A), pB = partenza(B);
if (Math.abs(pA[1] - pB[1]) > 0.01) throw new Error('le due varianti non stanno sulla stessa riga');
const moduli = doc.needle_blocks.filter((b) => oggettiDi(b).some(eBase)).map(partenza);
// il modulo A della colonna dopo: stessa riga, oltre B
const dopo = moduli.filter((p) => Math.abs(p[1] - pA[1]) < 0.01 && p[0] > pB[0] + 1).sort((a, b) => a[0] - b[0])[0];
const righeSotto = moduli.filter((p) => Math.abs(p[0] - pA[0]) < 0.01 && p[1] > pA[1] + 1).sort((a, b) => a[1] - b[1])[0];
if (!dopo || !righeSotto) throw new Error('non trovo la colonna dopo o la riga sotto');
const modulo = {
  formato: 'rete-modulo-1', nome: 'Modulo da file',
  passi: { colonne: tondo((dopo[0] - pA[0]) / 2), righe: tondo(righeSotto[1] - pA[1]) },
  varianti: { A: estrai(A), B: estrai(B) },
  origine: [tondo(pA[0]), tondo(pA[1])],
};
writeFileSync(uscita, JSON.stringify(modulo));
console.log(`scritto ${uscita}: passi ${modulo.passi.colonne} / ${modulo.passi.righe} mm (nel file ${tondo(pB[0] - pA[0])} e ${tondo(dopo[0] - pB[0])}), ${modulo.varianti.A.oggetti.length} e ${modulo.varianti.B.oggetti.length} oggetti`);
