const fs=require("fs");const C=JSON.parse(fs.readFileSync("corrente.json","utf8"));const {linee}=JSON.parse(fs.readFileSync("verde/linee-A.json","utf8"));
const base="http://127.0.0.1:5372";const mm=q=>[q.x_um/1000,q.y_um/1000];const D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);const t3=p=>[Math.round(p[0]*1000)/1000,Math.round(p[1]*1000)/1000];
const eCat=o=>o.kind==="running"&&o.source_path.point_count<20&&C.parameter_sets[o.serialized_parameter_index].values[37]===32;
const ePas=o=>o.kind==="running"&&o.source_path.point_count<20&&!eCat(o)&&o.serialized_parameter_index===1;
const proj=(q,t)=>{let best=[1e9,0],s=0;for(let i=1;i<t.length;i++){const l=D(t[i-1],t[i]),dx=t[i][0]-t[i-1][0],dy=t[i][1]-t[i-1][1];const f=l?Math.max(0,Math.min(1,((q[0]-t[i-1][0])*dx+(q[1]-t[i-1][1])*dy)/(l*l))):0;const e=D(q,[t[i-1][0]+dx*f,t[i-1][1]+dy*f]);if(e<best[0])best=[e,s+f*l];s+=l}return{e:best[0],s:best[1],L:s}};
function dividi(t,s){const a=[t[0]],b=[];let c=0,fatto=false;for(let i=1;i<t.length;i++){const l=D(t[i-1],t[i]);if(!fatto&&c+l>=s){const f=(s-c)/l;const p=[t[i-1][0]+(t[i][0]-t[i-1][0])*f,t[i-1][1]+(t[i][1]-t[i-1][1])*f];a.push(p);b.push(p);if(f<1)b.push(t[i]);fatto=true}else if(fatto)b.push(t[i]);else a.push(t[i]);c+=l}return[a,b]}
const scelte=[];const usati=new Set();
for(const [voglio,filtro] of [["catenella",eCat],["catenella",eCat],["passaggio",ePas]]){
 outer:for(let n=0;n<linee.length;n++){if(usati.has(n))continue;const l=linee[n];for(const cap of [0,1]){const q=cap?l.at(-1):l[0];for(const o of C.objects){if(!filtro(o)||o.stitch_count===0)continue;const b=o.source_path.bounds;if(q[0]<b.min_x_um/1000-.5||q[0]>b.max_x_um/1000+.5||q[1]<b.min_y_um/1000-.5||q[1]>b.max_y_um/1000+.5)continue;const t=o.source_path.points.map(mm);const r=proj(q,t);if(r.e<0.1&&r.s>4&&r.L-r.s>4&&!scelte.some(x=>x.o.needle===o.needle&&Math.abs(x.o.index-o.index)<3)){usati.add(n);scelte.push({n,voglio,o,t,r,lin:cap?[...l].reverse():l});break outer}}}}
}
const prog=[],canc=[];const bloccoDi=i=>C.needle_blocks.find(b=>i>=b.first_object_index&&i<=b.last_object_index);
for(const x of scelte){const bl=C.objects.slice(bloccoDi(x.o.index).first_object_index,bloccoDi(x.o.index).last_object_index+1);const pas=bl.find(ePas).index;const cat=x.voglio==="catenella"?x.o.index:bl.find(eCat).index;const[a,b]=dividi(x.t,x.r.s);const lin=x.lin.map(t3);
 prog.push({modello:x.o.index,dopo:x.o.index,contorno_mm:a.map(t3),nome:"parte1"},{modello:pas,dopo:x.o.index,contorno_mm:lin,nome:"imbastitura"},{modello:cat,dopo:x.o.index,contorno_mm:[...lin].reverse(),nome:"catenella"},{modello:x.o.index,dopo:x.o.index,contorno_mm:b.map(t3),nome:"parte2"});canc.push(x.o.index);}
(async()=>{const st=await(await fetch(base+"/stato")).json();if(!st.documento.includes("rg-andata-ritorno-prova")||st.oggetti!==3777)throw new Error("non e la copia pulita: "+st.documento+" "+st.oggetti);
 const post=async(v,c)=>(await fetch(base+v,{method:"POST",headers:{"X-RG-Link":"1","Content-Type":"application/json"},body:c?JSON.stringify(c):undefined})).json();
 const ord=[...canc].sort((a,b)=>b-a);
 for(const anc of ord){const r=await post("/running",{linee:prog.filter(l=>l.dopo===anc)});console.log("oggetto",anc,C.objects[anc].stitch_count,"punti, ago",C.objects[anc].needle,"->",JSON.stringify(r.dettaglio.map(d=>d.punti)),r.errori.length?r.errori:"")}
 // gli indici dopo gli inserimenti
 const pos=canc.map(i=>i+prog.filter(l=>l.dopo<i).length);const c=await post("/cancella?oggetti="+pos.join(","));console.log(JSON.stringify(c));
 // la catena: prima dell'oggetto, 4 pezzi, dopo; ora l'originale e' cancellato e al suo posto i 4
 const ordAsc=[...canc].sort((a,b)=>a-b);let extra=0;for(const anc of ordAsc){const k=anc+extra;const ids=[k-1,k,k+1,k+2,k+3,k+4];const r=await(await fetch(base+"/punti-cuciti?oggetti="+ids.join(","))).json();const nomi=["prima","parte1","imbastitura","catenella","parte2","dopo"];
  const g=[];for(let i=1;i<r.oggetti.length;i++){const a=r.oggetti[i-1].punti.at(-1),b=r.oggetti[i].punti[0];g.push(nomi[i-1]+">"+nomi[i]+" "+(Math.hypot(a[0]-b[0],a[1]-b[1])/1000).toFixed(2));}
  console.log("catena dell'oggetto",anc,"tipo",eCat(C.objects[anc])?"catenella":"passaggio","| punti",r.oggetti.map(o=>o.conta).join(","),"| aghi",r.oggetti.map(o=>o.ago).join(","),"|",g.join(" · "));extra+=3;
  const orig=C.objects[anc];const ga=D(mm(C.objects[anc-1].stitching_path.points.at(-1)),mm(orig.stitching_path.points[0])),gb=D(mm(orig.stitching_path.points.at(-1)),mm(C.objects[anc+1].stitching_path.points[0]));console.log("   prima della modifica: prima>oggetto",ga.toFixed(2),"· oggetto>dopo",gb.toFixed(2));}
})().catch(e=>console.log("ERRORE",e.message));
