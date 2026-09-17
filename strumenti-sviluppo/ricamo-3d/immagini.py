"""Immagini di confronto della simulazione: dall'alto e radenti, una riga per configurazione.

    python immagini.py file.dst --centro X Y --lato L [--strati 0 1 2] [--filato cotone_30] [--cucitura rigida]
                       [--fase rilasciato|cucito] [--cartella immagini] [--nome ricamo]
    python immagini.py file.dst ... --strati 2 --confronta-ventaglio      # rigida senza e con ventaglio

Scrive nella cartella una tavola (<nome>.png) e le singole immagini (<nome>-<riga>-alto.png, -radente.png).
Il filo è disegnato come tubo: dall'alto il colore è l'altezza (stessa scala per tutte le righe), nella
vista radente obliqua le altezze sono esagerate, così castelli, ventagli e archi si vedono. È un disegno 2D
con Pillow, non il visualizzatore three.js: serve a confrontare, non a guardare il ricamo.
"""
import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import modello as M
import parametri as P

FONDO = (58, 65, 72)
TELA = (109, 116, 112)
FILO_BASSO = np.array([120, 112, 96])
FILO_ALTO = np.array([246, 240, 222])
ESAGERAZIONE = 4.0          # la vista radente moltiplica le altezze
ELEVAZIONE = math.radians(28)


def simula(dst, centro, lato, filato, strati, cucitura, ventaglio):
    segs = M.ritaglio(M.fori_da_dst(dst), centro[0], centro[1], lato / 2)
    d_min = min(P.diametro_filo(f["tex"]) for f in P.FILATI.values())
    offs = M.costruisci_nodi(segs, d_min * P.PASSO_NODI_FRAZ_DIAMETRO)
    R = M.simula(segs, offs, filato, strati, lato / 2, cucitura=cucitura, ventaglio=ventaglio)
    return segs, offs, R


def _colore(z, zmin, zmax):
    f = 0.0 if zmax <= zmin else min(max((z - zmin) / (zmax - zmin), 0.0), 1.0)
    return tuple(int(v) for v in FILO_BASSO + (FILO_ALTO - FILO_BASSO) * f)


def dall_alto(pos, offs, lato, r, zmax, px_mm=24):
    W = int(lato * px_mm)
    img = Image.new("RGB", (W, W), TELA)
    g = ImageDraw.Draw(img)
    larghezza = max(2, int(round(2 * r * px_mm)))
    tratti = []
    for k in range(len(offs) - 1):
        p = pos[offs[k]:offs[k + 1]]
        for i in range(len(p) - 1):
            tratti.append(((p[i, 2] + p[i + 1, 2]) / 2, p[i], p[i + 1]))
    tratti.sort(key=lambda s: s[0])                    # dal basso in alto: quello sopra copre
    for z, a, b in tratti:
        g.line([((a[0] + lato / 2) * px_mm, (lato / 2 - a[1]) * px_mm),
                ((b[0] + lato / 2) * px_mm, (lato / 2 - b[1]) * px_mm)], fill=_colore(z, 0.0, zmax), width=larghezza)
    return img


def radente(pos, offs, lato, r, zmax, px_mm=24):
    s, c = math.sin(ELEVAZIONE), math.cos(ELEVAZIONE)
    alto_mm = lato * s + zmax * ESAGERAZIONE * c + 2
    W, H = int(lato * px_mm), int(alto_mm * px_mm)
    img = Image.new("RGB", (W, H), FONDO)
    g = ImageDraw.Draw(img)

    def proietta(x, y, z):
        return ((x + lato / 2) * px_mm, H - ((y + lato / 2) * s + z * ESAGERAZIONE * c + 1) * px_mm)
    tela = [proietta(-lato / 2, -lato / 2, 0), proietta(lato / 2, -lato / 2, 0), proietta(lato / 2, lato / 2, 0), proietta(-lato / 2, lato / 2, 0)]
    g.polygon(tela, fill=TELA)
    larghezza = max(2, int(round(2 * r * px_mm)))
    tratti = []
    for k in range(len(offs) - 1):
        p = pos[offs[k]:offs[k + 1]]
        for i in range(len(p) - 1):
            ym, zm = (p[i, 1] + p[i + 1, 1]) / 2, (p[i, 2] + p[i + 1, 2]) / 2
            tratti.append((ym * c - zm * s * ESAGERAZIONE, zm, p[i], p[i + 1]))
    tratti.sort(key=lambda t: -t[0])                   # dal fondo verso chi guarda
    for _, z, a, b in tratti:
        g.line([proietta(*a), proietta(*b)], fill=_colore(z, 0.0, zmax), width=larghezza)
    return img


def tavola(righe, titolo, sottotitolo, px_mm=24):
    """righe: (etichetta, misure, immagine dall'alto, immagine radente)."""
    font = lambda s: ImageFont.load_default(size=s)
    W1 = righe[0][2].width
    W2 = righe[0][3].width
    H1 = max(max(a.height, b.height) for _, _, a, b in righe)
    margine, testa, riga = 20, 70, 64
    tot = Image.new("RGB", (margine * 3 + W1 + W2, testa + len(righe) * (riga + H1 + margine)), (250, 249, 246))
    g = ImageDraw.Draw(tot)
    g.text((margine, 18), titolo, fill=(30, 30, 30), font=font(20))
    g.text((margine, 44), sottotitolo, fill=(90, 90, 90), font=font(15))
    y = testa
    for etichetta, misure, alto, rad in righe:
        g.text((margine, y + 8), etichetta, fill=(30, 30, 30), font=font(22))
        g.text((margine, y + 36), misure, fill=(70, 70, 70), font=font(16))
        tot.paste(alto, (margine, y + riga))
        tot.paste(rad, (margine * 2 + W1, y + riga + (H1 - rad.height)))
        y += riga + H1 + margine
    return tot


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dst")
    ap.add_argument("--centro", type=float, nargs=2, default=(0.0, 0.0))
    ap.add_argument("--lato", type=float, default=22.0)
    ap.add_argument("--filato", default="cotone_30")
    ap.add_argument("--strati", type=int, nargs="+", default=[0, 1, 2])
    ap.add_argument("--cucitura", choices=("rigida", "incrementale"), default="rigida")
    ap.add_argument("--fase", choices=("rilasciato", "cucito"), default="rilasciato")
    ap.add_argument("--confronta-ventaglio", action="store_true", help="rigida senza e con ventaglio, per ogni numero di strati")
    ap.add_argument("--cartella", default="immagini")
    ap.add_argument("--nome", default="ricamo")
    args = ap.parse_args()

    configurazioni = []
    for strati in args.strati:
        if args.confronta_ventaglio:
            configurazioni += [(strati, False, f"{strati} strati, senza ventaglio"), (strati, True, f"{strati} strati, con ventaglio")]
        else:
            configurazioni.append((strati, True, f"{strati} {'strato' if strati == 1 else 'strati'} di garza"))

    risultati = []
    for strati, ventaglio, etichetta in configurazioni:
        segs, offs, R = simula(args.dst, args.centro, args.lato, args.filato, strati, args.cucitura, ventaglio)
        r = R["d"] / 2
        n, larg, alt = M.misura_fasci(R[args.fase], offs, segs, r)
        arco = M.altezza_media(R[args.fase], offs, r)[0]
        misure = (f"fasci da {P.FASCIO_MIN_PASSAGGI}+ passaggi: {n} · larghezza max {larg:.2f} mm · altezza max {alt:.2f} mm · "
                  f"arco medio {arco:.2f} mm") if n else f"nessun fascio · arco medio {arco:.2f} mm"
        risultati.append((strati, ventaglio, etichetta, misure, offs, R[args.fase], r))
    zmax = max(float(pos[:, 2].max()) for *_, pos, _ in risultati)

    cartella = Path(args.cartella)
    cartella.mkdir(parents=True, exist_ok=True)
    righe = []
    for strati, ventaglio, etichetta, misure, offs, pos, r in risultati:
        alto, rad = dall_alto(pos, offs, args.lato, r, zmax), radente(pos, offs, args.lato, r, zmax)
        coda = f"{strati}strati" + ("" if not args.confronta_ventaglio else ("-ventaglio" if ventaglio else "-senza-ventaglio"))
        alto.save(cartella / f"{args.nome}-{coda}-alto.png")
        rad.save(cartella / f"{args.nome}-{coda}-radente.png")
        righe.append((etichetta, misure, alto, rad))
    titolo = (f"Cucitura {args.cucitura} · {Path(args.dst).name} · ritaglio {args.lato:g} mm in ({args.centro[0]:g}, {args.centro[1]:g}) · "
              f"{args.filato.replace('_', ' ')} · {'garza rimossa' if args.fase == 'rilasciato' else 'durante il ricamo'}")
    sotto = (f"Colore = altezza del filo (stessa scala per tutte le righe, da 0 a {zmax:.2f} mm). "
             f"Vista radente con altezze moltiplicate per {ESAGERAZIONE:g}.")
    tavola(righe, titolo, sotto).save(cartella / f"{args.nome}.png")
    print("scritto", cartella / f"{args.nome}.png", "e", 2 * len(righe), "immagini singole")


if __name__ == "__main__":
    main()
