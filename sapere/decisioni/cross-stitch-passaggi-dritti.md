# Punto croce: i passaggi nascosti dritti (prova)

**2026-10-19.** Lorenzo: «i passaggi coperti ora si muovono a zig zag sotto il filo che poi li copre: vorrei provare
delle linee a impuntura che passano perfettamente al centro delle V che passano sopra in copertura, al centro
rispetto all'altezza; soprattutto i movimenti orizzontali».

- Il percorso resta quello del motore (sul reticolo, a zig zag sulle gambe delle V che coprono). Cambia solo come si
  cuce: `straightHiddenRuns` (routing.ts) trova le corse di passaggio **nascosto** di almeno due mezze V di fila,
  nella stessa riga e nello stesso verso, e le rifà dritte: dal capo di partenza al centro di ogni V
  (x = colonna dispari del reticolo) a metà altezza della riga (r·passo + altezza/2), poi al capo d'arrivo. I punti
  cadono al centro delle V; fra un centro e l'altro (una V, 2,8 mm) non serve spezzare.
- `StitchParams.straightHidden` (interruttore in *05 Macchina*, spento di partenza): vale per anteprima,
  `colorPolylinesTrim` (SVG e DST) e il conteggio dei punti sviluppati (ricontato quando cambia la macchina).
- Sul retro V1 (2,8 × 4): punti sviluppati 171.441 → 168.887. Da provare a macchina se la linea a metà V resta
  coperta come lo zig zag sulle gambe.
