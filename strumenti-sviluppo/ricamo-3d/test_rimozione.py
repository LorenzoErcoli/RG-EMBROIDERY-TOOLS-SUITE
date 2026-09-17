"""Test: con 0 strati di garza la rimozione non deve muovere niente.

    python test_rimozione.py            # esce con 1 se un caso non passa

Per ogni caso simula a 0 strati e misura lo spostamento massimo di qualunque nodo fra la geometria cucita
(lo stato di riposo) e quella dopo il rilassamento: deve stare sotto SOGLIA_MM. Controlla anche che con 2
strati la simulazione finisca senza NaN.
"""
import json
import sys
from pathlib import Path

import numpy as np

import modello as M
import parametri as P

QUI = Path(__file__).parent
SOGLIA_MM = 0.02
PATTERN = Path.home() / "Downloads" / "pattern (1).dst"


def segmenti_zona(zona):
    desc = json.loads((QUI / "calibrazione" / "calibrazione_zone.json").read_text(encoding="utf-8"))
    z = next(q for q in desc["zone"] if q["id"] == zona)
    x0, y0, x1, y1 = z["riquadro_mm"]
    S = M.fori_da_dst(str(QUI / "calibrazione" / desc["file"]))
    t = 0.051
    m = ((np.minimum(S[:, 0], S[:, 2]) >= x0 - t) & (np.maximum(S[:, 0], S[:, 2]) <= x1 + t) &
         (np.minimum(S[:, 1], S[:, 3]) >= y0 - t) & (np.maximum(S[:, 1], S[:, 3]) <= y1 + t))
    ml = max(x1 - x0, y1 - y0) / 2 + 1
    return M.ritaglio(S[m], (x0 + x1) / 2, (y0 + y1) / 2, ml), ml


def casi():
    for zona in ("A", "D", "G", "H"):
        yield f"zona {zona}", *segmenti_zona(zona)
    if PATTERN.exists():
        yield "pattern (1).dst, 22 mm al centro", M.ritaglio(M.fori_da_dst(str(PATTERN)), 0, 0, 11), 11.0


def main():
    d_min = min(P.diametro_filo(f["tex"]) for f in P.FILATI.values())
    falliti = 0
    for nome, segs, mezzo in casi():
        offs = M.costruisci_nodi(segs, d_min * P.PASSO_NODI_FRAZ_DIAMETRO)
        for cucitura in ("rigida", "incrementale"):
            for filato in P.FILATI:
                R = M.simula(segs, offs, filato, 0, mezzo, cucitura=cucitura)
                spost = float(np.abs(R["rilasciato"] - R["cucito_zero"]).max())
                ok = spost < SOGLIA_MM and not np.isnan(R["rilasciato"]).any()
                falliti += not ok
                print(f"  {'ok' if ok else 'NO':<3} {nome:<34} {cucitura:<12} {filato:<10} 0 strati: spostamento max {spost:.5f} mm")
            R2 = M.simula(segs, offs, "cotone_30", 2, mezzo, cucitura=cucitura)
            ok2 = not np.isnan(R2["rilasciato"]).any()
            falliti += not ok2
            print(f"  {'ok' if ok2 else 'NO':<3} {nome:<34} {cucitura:<12} cotone_30  2 strati: nessun NaN")
    print("TUTTO VERIFICATO" if not falliti else f"{falliti} CASI FALLITI")
    return 1 if falliti else 0


if __name__ == "__main__":
    sys.exit(main())
