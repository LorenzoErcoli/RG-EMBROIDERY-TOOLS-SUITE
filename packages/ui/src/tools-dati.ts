// Registro dei tool della suite RG Tools + chrome condiviso (topbar).
export interface ToolDef {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'soon';
  /**
   * In quale pagina sta il tool. `suite` = la home, gli strumenti pronti per il lavoro.
   * `sviluppo` = la pagina a parte coi progetti non finiti: si aprono e si usano, ma non sono
   * ancora strumenti su cui contare (decisione di Lorenzo, 2026-09-16).
   */
  section: 'suite' | 'sviluppo';
  /** Link esterno: il tool vive fuori dalla suite (non ancora migrato) e si apre in una scheda nuova. */
  href?: string;
  /**
   * Cosa il tool PRENDE come punto di partenza (K4): `svg` e `dxf` = un disegno vettoriale (cartamodello, zone),
   * `raster` = un'immagine, `dst` = un ricamo già cucito. Non conta il riaprire un progetto uscito dal tool
   * (tutti riaprono il proprio SVG/DST). Un test lo confronta con quello che i file di caricamento accettano davvero.
   */
  ingressi: FormatoIngresso[];
  /** Cosa il tool DÀ (K4): oggi tutti l'SVG e il DST. Un test lo confronta coi bottoni di export. */
  uscite: FormatoUscita[];
  /**
   * Le tecniche di punto che sa fare, dalla tassonomia R24 (K4). Assente finché Lorenzo non conferma la mappa
   * tool → tecniche (è una decisione di mestiere, non si ricava dal codice): il debito è in test/smoke.mjs.
   */
  tecniche?: TecnicaR24[];
}

export type FormatoIngresso = 'svg' | 'dxf' | 'raster' | 'dst';
export type FormatoUscita = 'svg' | 'dst';
/** I tipi di punto canonici (COSTITUZIONE R24). */
export type TecnicaR24 = 'corsa' | 'raso' | 'cordoncino' | 'catenella' | 'zigzag' | 'tatami' | 'croce';

export const TOOLS: ToolDef[] = [
  { id: 'net-45', name: 'Rete 45°', description: 'Genera la rete di cordoncini a 45° su una sagoma DXF/SVG.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'pattern-grammar', name: 'Generatore pattern', description: 'Genera pattern e basi ricamo da grammatica, con sagoma importabile.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'interlace', name: 'Interlace', description: 'Riempimento a intreccio multicolore: passaggi brevi che si intrecciano, con aree vuote.', ingressi: ['svg', 'dxf', 'raster'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'oblique', name: 'Oblique Pattern', description: 'Pattern obliqui a più livelli (Broderie Anglaise) con fori laser.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'cross-stitch', name: 'Punto croce', description: 'Griglia di celle con diagonali, V e croci in più fili: i passaggi si calcolano da soli e finiscono sotto il ricamo che viene dopo. Export SVG e DST.', ingressi: ['raster', 'svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'bitmap', name: 'Bitmap → Stitch', description: 'Da immagine raster a tracciato di ricamo: selezione pixel, colori e punti ordinati in SVG.', ingressi: ['raster'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'striatura', name: 'Punto Striato', description: 'Striature verticali a spola che formano macchie maculate su base di riempimento parallelo.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'zone-pattern', name: 'Pattern a zone', description: 'Riempie ogni zona colorata di un disegno col suo pattern, ruotato sulle perpendicolari della zona.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'cannage-rafia', name: 'Cannage rafia', description: 'Il programma di una borsa in cannage rafia da un SVG a zone. Per ora le linee orizzontali e verticali, agganciate ai rombi del pattern 1: cordoncini, fermi, scalette e meandri come nel DST di riferimento.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'broccato', name: 'Broccato', description: 'Da immagine a ricamo: aree di colore riempite a raso rado orizzontale, a pettine o normale, coi passaggi nascosti sotto i colori successivi.', ingressi: ['raster'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
  { id: 'sfrangiatura', name: 'Sfrangiatura', description: 'Aggiunge frange che si intrecciano a X sui capi dei rasi di un DST già cucito, solo dove marchi col pennello. Il ricamo di partenza non si tocca.', ingressi: ['dst'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
  { id: 'pettine', name: 'Punto pettine sfrangiato', description: 'Da un SVG a gruppi e da una fotografia: linee di base a passo fisso con sopra un pettine di denti rivolti verso il chiaro, col ritaglio per provare uno swatch prima del pannello.', ingressi: ['svg', 'raster'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'razza', name: 'Punto razza', description: 'Riempie una sagoma di pallini di cordoncino, piccoli ai bordi e grandi verso il centro, con pallini fissi e linee di sfumatura a scelta. Passaggi corti e coperti. Export SVG e DST.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'suite' },
  { id: 'pattern-macchie', name: 'Pattern a macchie', description: 'Un pannello col suo pattern di base e, dentro le macchie del disegno, un raso sfrangiato con sopra lo stesso punto della base, a registro. Mai un punto fra una macchia e l’altra; ponti facoltativi fra macchie vicine. Export SVG e DST in tre stop.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
  { id: 'pittorico', name: 'Punto Pittorico', description: 'Da immagine a ricamo pittorico: il punto attraversa il passaggio di colore, degradé col frastaglio dei bordi dove il colore sfuma, taglio secco dove stacca.', ingressi: ['raster'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
  { id: 'rete-testa-speciale', name: 'Rete testa speciale', description: 'Rete a rombi fatta di serpentine che scendono e risalgono a zig-zag: una sovrapposizione per ogni incrocio, punto più corto nelle sovrapposizioni, linee fino al bordo e filo spesso affiancato sul contorno, con le aree vuote. Per le teste speciali.', ingressi: ['svg', 'dxf'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
  { id: 'punto-maglia', name: 'Punto maglia', description: 'Disegni i tratti a mano (anche ricalcando una foto) e diventano un cordoncino di V a maglia che gira morbido lungo le curve: centro rialzato da 1, 1,5 o 2 colonne con le mezze catene ai lati, gambe e passaggi mai spezzati. Negli incroci il tratto sopra toglie le righe di quello sotto. Export SVG e DST.', ingressi: ['raster'], uscite: ['svg', 'dst'], status: 'live', section: 'sviluppo' },
];
