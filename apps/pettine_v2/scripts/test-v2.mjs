import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = fileURLToPath(new URL('../validation/', import.meta.url));
mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `export * from './apps/pettine_v2/src/pianificatore.ts'; export * from './apps/pettine_v2/src/motore.ts'; export * from './apps/pettine_v2/src/verifica-piano.ts'; export { costruisciPettine as originale } from './apps/pettine_v2/src/riferimento-v1.ts';`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', outfile: out + 'engine.mjs', alias: { '@rg/core': root + 'packages/core/src/index.ts', '@rg/pattern-grammar': root + 'packages/pattern-grammar/src/index.ts' } });
const { pianifica, verificaPiano, costruisciPettine, originale, parametriPettineDefault } = await import(new URL('../validation/engine.mjs', import.meta.url));
const p = (x, y) => ({ x, y });
const riga = (x0, x1, y, d, fi = 0, col = 0) => ({ col, fi, id: d, d, base: [p(x0,y), p(x1,y)], denti: Array.from({length: Math.floor((x1-x0)/2)+1},(_,i) => [p(x0+2*i,y),p(x0+2*i,y-3)]) });
const cases = [
  ['serpentina', [riga(0,30,0,0), riga(0,30,2,2), riga(0,30,4,4)]],
  ['macchia-10mm-prima-del-blocco', [riga(10,20,0,0), riga(0,40,2,2), riga(0,40,4,4)]],
  ['macchia-10mm-dopo-il-blocco', [riga(0,40,0,0), riga(10,20,2,2), riga(0,40,4,4)]],
  ['famiglie-diverse-vicine', [riga(0,30,0,0,0), riga(10,20,2,0,1),riga(0,30,4,0,2)]],
  ['vuoto-non-attraversabile', [riga(0,10,0,0),riga(20,30,0,0)]],
  ['nessuna-copertura-futura', [riga(0,10,0,0),riga(0,10,8,8)]],
  ['vuoto-sotto-colore-successivo', [riga(0,10,0,0),riga(20,30,0,0),riga(0,30,2,2,0,1)]],
  ['due-macchie-vicine', [riga(10,20,0,0),riga(40,50,0,0),riga(0,60,2,2),riga(0,60,4,4)]],
];
const reports = [];
for (const [name, rows] of cases) {
  const plan = pianifica(rows);
  const st = plan.statistiche;
  const audit = verificaPiano(plan);
  assert.equal(audit.prontoPerSwatch, true, name + ': ' + JSON.stringify(audit));
  console.log(name, JSON.stringify(st));
  assert.equal(plan.operazioni.filter(o=>o.tipo==='ricamo').length, plan.pezzi.length);
  const thread = ps => ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-ps[i].x,p.y-ps[i].y),0);
  const expected = rows.reduce((s,r)=>s+thread(r.base)+r.denti.reduce((sum,d)=>sum+2*thread(d),0),0);
  const actual = plan.operazioni.filter(o=>o.tipo==='ricamo').reduce((s,o)=>s+thread(o.punti),0);
  assert.ok(Math.abs(expected-actual)<0.001,`${name}: tutte le basi e tutti i denti devono essere ricamati esattamente una volta`);
  if (name.includes('vuoto') || name.includes('nessuna')) assert.equal(st.tagli, 1);
  else assert.equal(st.tagli, 0, `${name}: la macchia vicina deve restare collegata`);
  reports.push({name, ...st});
  writeFileSync(out+name+'.json',JSON.stringify(plan));
}
// La verifica deve scoprire un errore anche quando l'instradatore dichiara
// coperture valide: spostiamo un passaggio sul tessuto nudo mantenendo i suoi ID.
const broken=pianifica(cases[0][1]);
const travel=broken.operazioni.find(o=>o.tipo==='passaggio');
travel.punti=travel.punti.map(p=>({x:p.x+100,y:p.y}));
assert.ok(verificaPiano(broken).passaggioScopertoMm>1);
const order=pianifica(cases[0][1]);
const [a,b]=order.precedenze[0];
const ia=order.operazioni.findIndex(o=>o.pezzo===a),ib=order.operazioni.findIndex(o=>o.pezzo===b);
[order.operazioni[ia],order.operazioni[ib]]=[order.operazioni[ib],order.operazioni[ia]];
assert.ok(verificaPiano(order).precedenzeInvertite>0);
if (process.argv.includes('--real') || process.argv.includes('--accettazione')) {
 const fixture='apps/pettine_v2/fixtures/VETTORIALE-6-colori-v2-gruppo-blocchi.svg';
 const ing={testoSvg:readFileSync(root+fixture,'utf8'),larghezzaRealeMm:419.45,ritaglio:{x:120,y:120,larghezza:70,altezza:70}};
 const params={...parametriPettineDefault,passaggioNascostoMm:45};
 const risultati={};
 for(const [name,fn] of [['v1',originale],['v2',costruisciPettine]]) {
  const result=fn(ing,params);
  risultati[name]=result;
  console.log(name,JSON.stringify(result.statistiche));
  writeFileSync(out+name+'-reale.svg',result.svg);
  if(result.dst) writeFileSync(out+name+'-reale.dst',result.dst); else rmSync(out+name+'-reale.dst',{force:true});
  writeFileSync(out+name+'-reale.json',JSON.stringify({statistiche:result.statistiche,note:result.note,piano:result.piano,verifica:result.verifica}));
 }
 const promossa=risultati.v2.verifica.prontoPerSwatch && risultati.v2.statistiche.salti<=risultati.v1.statistiche.salti && risultati.v2.statistiche.passaggi<=risultati.v1.statistiche.passaggi;
 writeFileSync(out+'accettazione.json',JSON.stringify({promossa,v1:risultati.v1.statistiche,v2:risultati.v2.statistiche,verifica:risultati.v2.verifica},null,2));
 console.log(promossa?'Accettazione reale superata.':'Accettazione reale NON superata: prototipo ancora da correggere.');
 if(!promossa && process.argv.includes('--accettazione')) process.exitCode=1;
}
writeFileSync(out+'tests.json',JSON.stringify(reports,null,2));
writeFileSync(out+'baseline.json',JSON.stringify({sha256:createHash('sha256').update(readFileSync(root+'apps/pettine_v2/src/riferimento-v1.ts')).digest('hex'),source:'src/riferimento-v1.ts',fixture:'fixtures/VETTORIALE-6-colori-v2-gruppo-blocchi.svg',foto:null,larghezzaMm:419.45,ritaglio:{x:120,y:120,larghezza:70,altezza:70},parametriReali:{...parametriPettineDefault,passaggioNascostoMm:45}},null,2));
console.log('Otto regressioni geometriche e due controlli negativi superati; vedere separatamente l’accettazione reale.');
