"""Genera le varianti (filato x strati) per il visualizzatore e stampa le metriche.

    python esegui.py [file.dst]                    ritaglio 22 x 22 mm al centro del disegno
    python esegui.py --zona C [--zone file.json]   una zona di calibrazione_zone.json (DST preso dal JSON)
    python esegui.py ... --cucitura rigida         la cucitura vecchia (heightfield), per confronto

`simula_varianti` è usata anche da server.py (l'interfaccia per caricare i DST).
"""
import argparse, json, base64, time
from pathlib import Path
import numpy as np
import modello as M
import parametri as P

qui = Path(__file__).parent
QUANT = 0.004         # mm per unità int16
MARGINE_ZONA = 1.0    # mm di tessuto attorno alla zona, per garza e visualizzatore


def pack(p):
    q = np.round(p / QUANT).astype(np.int16)
    return base64.b64encode(q.tobytes()).decode()


def simula_varianti(segs5, mezzo_lato, lato_copertura=None, rett_copertura=None, descrizione=None, avviso=print,
                    cucitura="incrementale"):
    """Tutte le varianti filato x strati di un insieme di segmenti già centrati.

    `segs5`: colonne ax, ay, bx, by, ago. `avviso(testo)` riceve le stesse righe che stampa la riga di comando.
    Restituisce il dizionario che il visualizzatore legge come DATI.
    """
    segs = np.ascontiguousarray(segs5[:, :4])
    aghi = segs5[:, 4].astype(np.uint8)
    d_min = min(P.diametro_filo(f["tex"]) for f in P.FILATI.values())
    offs = M.costruisci_nodi(segs, d_min * P.PASSO_NODI_FRAZ_DIAMETRO)
    avviso(f"segmenti {len(segs)} nodi {offs[-1]}")

    out = {"quant": QUANT, "offs": base64.b64encode(offs.astype(np.uint32).tobytes()).decode(),
           "mezzo_lato": mezzo_lato, "aghi": base64.b64encode(aghi.tobytes()).decode(), "cucitura": cucitura,
           "varianti": {}}
    if descrizione:
        out["descrizione"] = descrizione
    for filato in P.FILATI:
        for strati in (0, 1, 2):
            t0 = time.time()
            R = M.simula(segs, offs, filato, strati, mezzo_lato, cucitura=cucitura)
            r = R["d"] / 2
            met = {
                "diametro_mm": round(R["d"], 3),
                "garza_compressa_mm": round(R["h_garza"], 3),
                "eccesso_filo_pct": round(R["eccesso_medio_pct"], 1),
                "copertura_cucito_pct": round(100 * M.copertura(R["cucito"], offs, R["d"], lato_copertura, rett=rett_copertura), 1),
                "copertura_rilasciato_pct": round(100 * M.copertura(R["rilasciato"], offs, R["d"], lato_copertura, rett=rett_copertura), 1),
                "arco_medio_mm": round(M.altezza_media(R["rilasciato"], offs, r)[0], 3),
                "errore_lunghezza_pct": round(R["err_lunghezza_pct"], 2),
                "arco_p90_mm": round(M.altezza_media(R["rilasciato"], offs, r)[1], 3),
            }
            bordo = M.altezza_bordo(R["rilasciato"], offs, segs, r)
            met["bordo_04_mm"] = None if bordo is None else round(bordo, 3)   # punti > 3,5 mm, a 0,4 mm dal foro
            ferm = M.altezza_fermature(R["rilasciato"], offs, segs, r)
            met["fermature_altezza_mm"] = None if ferm is None else round(ferm, 3)
            spost = R["spostamento_laterale_mm"]
            met["spostamento_laterale_mm"] = None if spost is None else round(spost, 3)
            met["fili_infilzati"] = R["infilzati"]
            key = f"{filato}|{strati}"
            out["varianti"][key] = {"metriche": met, "cucito": pack(R["cucito"]), "rilasciato": pack(R["rilasciato"])}
            if R["compattazione"] is not None:   # sezione ellittica: 255 = tonda
                c8 = np.round(np.clip(R["compattazione"], 0, 1) * 255).astype(np.uint8)
                out["varianti"][key]["compattazione"] = base64.b64encode(c8.tobytes()).decode()
            avviso(f"{key} {met} {time.time()-t0:.1f}s")
    return out


def html_visualizzatore(dati):
    """Il visualizzatore con i dati dentro (dati=None: pagina vuota, per server.py)."""
    return (qui / "viewer_template.html").read_text(encoding="utf-8").replace("__DATI__", json.dumps(dati))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dst", nargs="?", help="file DST (default: pattern (1).dst, o quello indicato nel JSON con --zona)")
    ap.add_argument("--zona", help="id della zona da simulare al posto del ritaglio centrale (es. A, B, C)")
    ap.add_argument("--zone", default=str(qui / "calibrazione" / "calibrazione_zone.json"),
                    help="JSON delle zone (default: calibrazione/calibrazione_zone.json)")
    ap.add_argument("--cucitura", choices=("incrementale", "rigida"), default="incrementale",
                    help="incrementale (nodi fisici, ago, attrito: predefinita) o rigida (heightfield, per confronto)")
    args = ap.parse_args()

    if args.zona is None:
        mezzo_lato = 11.0     # ritaglio 22 x 22 mm al centro
        dst = args.dst or "pattern (1).dst"
        segs = M.ritaglio(M.fori_da_dst(dst, con_ago=True), 0.0, 0.0, mezzo_lato)
        rett_copertura = None
        lato_copertura = mezzo_lato - 1.5
        uscita = "rg-ricamo-3d-termogarza.html"
        descrizione = None
    else:
        percorso_json = Path(args.zone)
        desc = json.loads(percorso_json.read_text(encoding="utf-8"))
        zona = next((z for z in desc["zone"] if z["id"] == args.zona), None)
        if zona is None:
            raise SystemExit(f"zona {args.zona!r} non trovata in {percorso_json} (ci sono: {', '.join(z['id'] for z in desc['zone'])})")
        dst = args.dst or str(percorso_json.parent / desc["file"])
        x0, y0, x1, y1 = zona["riquadro_mm"]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        segs_all = M.fori_da_dst(dst, con_ago=True)
        tol = 0.051   # i fori sono sulla griglia da 0,1 mm del DST
        dentro = ((np.minimum(segs_all[:, 0], segs_all[:, 2]) >= x0 - tol) & (np.maximum(segs_all[:, 0], segs_all[:, 2]) <= x1 + tol) &
                  (np.minimum(segs_all[:, 1], segs_all[:, 3]) >= y0 - tol) & (np.maximum(segs_all[:, 1], segs_all[:, 3]) <= y1 + tol))
        mezzo_lato = max(x1 - x0, y1 - y0) / 2 + MARGINE_ZONA
        segs = M.ritaglio(segs_all[dentro], cx, cy, mezzo_lato)   # centra sulla zona (il quadrato non taglia nulla)
        # copertura sul riquadro della zona, bordo compreso (almeno 1 mm per lato: la zona G è una fila di fermature)
        mx, my = max((x1 - x0) / 2, 0.5), max((y1 - y0) / 2, 0.5)
        rett_copertura = (-mx, -my, mx, my)
        lato_copertura = None
        uscita = f"rg-ricamo-3d-zona-{zona['id']}.html"
        descrizione = (f"Zona {zona['id']} di {Path(dst).name}: {zona['nome'].lower()}, "
                       f"{x1 - x0:.1f} × {y1 - y0:.1f} mm, cotone naturale. Parametri fisici di partenza, non ancora calibrati.")
        print(f"zona {zona['id']} ({zona['nome']}), riquadro {zona['riquadro_mm']}, {zona['punti']} punti nel JSON")

    if args.cucitura == "rigida":
        uscita = uscita.replace(".html", "-rigida.html")
        descrizione = (descrizione or "Ritaglio 22 × 22 mm al centro del disegno.") + " Cucitura rigida (heightfield)."
    out = simula_varianti(segs, mezzo_lato, lato_copertura, rett_copertura, descrizione, cucitura=args.cucitura)
    (qui / uscita).write_text(html_visualizzatore(out), encoding="utf-8")
    print("scritto", uscita)


if __name__ == "__main__":
    main()
