"""Genera le varianti (filato x strati) per il visualizzatore e stampa le metriche."""
import json, base64, sys, time
from pathlib import Path
import numpy as np
import modello as M
import parametri as P

DST = sys.argv[1] if len(sys.argv) > 1 else "pattern (1).dst"
MEZZO_LATO = 11.0     # ritaglio 22 x 22 mm al centro
QUANT = 0.004         # mm per unità int16

segs_all = M.fori_da_dst(DST)
segs = M.ritaglio(segs_all, 0.0, 0.0, MEZZO_LATO)
d_min = min(P.diametro_filo(f["tex"]) for f in P.FILATI.values())
offs = M.costruisci_nodi(segs, d_min * P.PASSO_NODI_FRAZ_DIAMETRO)
print("segmenti", len(segs), "nodi", offs[-1])

def pack(p):
    q = np.round(p / QUANT).astype(np.int16)
    return base64.b64encode(q.tobytes()).decode()

out = {"quant": QUANT, "offs": base64.b64encode(offs.astype(np.uint32).tobytes()).decode(),
       "mezzo_lato": MEZZO_LATO, "varianti": {}}
for filato in P.FILATI:
    for strati in (0, 1, 2):
        t0 = time.time()
        R = M.simula(segs, offs, filato, strati, MEZZO_LATO)
        r = R["d"] / 2
        met = {
            "diametro_mm": round(R["d"], 3),
            "garza_compressa_mm": round(R["h_garza"], 3),
            "eccesso_filo_pct": round(R["eccesso_medio_pct"], 1),
            "copertura_cucito_pct": round(100 * M.copertura(R["cucito"], offs, R["d"], MEZZO_LATO - 1.5), 1),
            "copertura_rilasciato_pct": round(100 * M.copertura(R["rilasciato"], offs, R["d"], MEZZO_LATO - 1.5), 1),
            "arco_medio_mm": round(M.altezza_media(R["rilasciato"], offs, r)[0], 3),
            "errore_lunghezza_pct": round(R["err_lunghezza_pct"], 2),
            "arco_p90_mm": round(M.altezza_media(R["rilasciato"], offs, r)[1], 3),
        }
        key = f"{filato}|{strati}"
        out["varianti"][key] = {"metriche": met, "cucito": pack(R["cucito"]), "rilasciato": pack(R["rilasciato"])}
        print(key, met, f"{time.time()-t0:.1f}s")

# visualizzatore: inserisce i dati nel modello HTML
from pathlib import Path
qui = Path(__file__).parent
html = (qui / "viewer_template.html").read_text(encoding="utf-8").replace("__DATI__", json.dumps(out))
(qui / "rg-ricamo-3d-termogarza.html").write_text(html, encoding="utf-8")
print("scritto rg-ricamo-3d-termogarza.html")
