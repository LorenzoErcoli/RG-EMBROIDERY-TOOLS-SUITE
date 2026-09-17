"""Rilegge calibrazione.dst con dst_reader.py e lo confronta con calibrazione_zone.json.

Uso: python verifica_calibrazione.py [cartella]   (default: calibrazione/ accanto a questo file)
Esce con codice 1 se un controllo fallisce.
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path

import modello as M
from dst_reader import read_dst

QUI = Path(__file__).parent
CARTELLA = Path(sys.argv[1]) if len(sys.argv) > 1 else QUI / "calibrazione"
TOL = 1e-6
falliti = []


def controlla(cond, testo):
    print(("  ok    " if cond else "  NO    ") + testo)
    if not cond:
        falliti.append(testo)


def uguale(a, b):
    return all(abs(x - y) < TOL + 0.049 / 10 for x, y in zip(a, b)) and len(a) == len(b)


def riquadro(pp):
    return [min(p[0] for p in pp), min(p[1] for p in pp), max(p[0] for p in pp), max(p[1] for p in pp)]


def distanza(r1, r2):
    dx = max(0.0, r2[0] - r1[2], r1[0] - r2[2])
    dy = max(0.0, r2[1] - r1[3], r1[1] - r2[3])
    return math.hypot(dx, dy)


desc = json.loads((CARTELLA / "calibrazione_zone.json").read_text(encoding="utf-8"))
dst = CARTELLA / desc["file"]
header, recs = read_dst(str(dst))

# ---------------------------------------------------------------- decodifica in blocchi
# un blocco = punti consecutivi; salto e cambio colore lo chiudono. Il primo foro è dove finisce il salto.
blocchi, cur, ago, cambi = [], None, 1, 0
pos, lunghezze_record = (0.0, 0.0), []
for x, y, t in recs:
    if t == "end":
        break
    lunghezze_record.append((t, math.hypot(x - pos[0], y - pos[1])))
    if t == "stitch":
        if cur is None:
            cur = {"ago": ago, "punti": [pos], "n": 0}
            blocchi.append(cur)
        cur["punti"].append((x, y)); cur["n"] += 1
    else:
        cur = None
        if t == "color":
            ago += 1; cambi += 1
    pos = (x, y)

print(f"{dst.name}: {len(recs)} record")
print("\nIntestazione e totali")
campi = {r.split(":")[0]: r.split(":", 1)[1].strip() for r in header.split("\r") if ":" in r}
n_punti = sum(b["n"] for b in blocchi)
tutti = [p for b in blocchi for p in b["punti"]]
controlla(int(campi["ST"]) == n_punti == desc["punti_totali"], f"punti: header {campi['ST']}, letti {n_punti}, JSON {desc['punti_totali']}")
controlla(int(campi["CO"]) == cambi == desc["cambi_colore"], f"cambi colore: header {campi['CO']}, letti {cambi}, JSON {desc['cambi_colore']}")
rt = riquadro(tutti)
controlla(uguale(rt, desc["riquadro_totale_mm"]), f"riquadro totale letto {rt} = JSON {desc['riquadro_totale_mm']}")
area = desc["area_nominale_mm"]
controlla(abs(rt[2] - rt[0] - area[0]) < 0.05 and abs(rt[3] - rt[1] - area[1]) < 0.05 and abs(rt[0] + rt[2]) < 0.15 and abs(rt[1] + rt[3]) < 0.15,
          f"area {rt[2]-rt[0]:.1f} x {rt[3]-rt[1]:.1f} mm = JSON {area}, centrata sull'origine")
controlla([int(campi[k]) / 10 for k in ("+X", "-X", "+Y", "-Y")] == [rt[2], -rt[0], rt[3], -rt[1]], "estensioni +X -X +Y -Y dell'header")
lmax = max(l for _, l in lunghezze_record)
lmax_punto = max(l for t, l in lunghezze_record if t == "stitch")
controlla(lmax <= 12.1 + TOL, f"record più lungo {lmax:.2f} mm (punto più lungo {lmax_punto:.2f} mm), limite 12,1")
controlla(all(l > 0 for t, l in lunghezze_record if t == "stitch"), "nessun punto di lunghezza zero")
segs = M.fori_da_dst(str(dst))
controlla(len(segs) == n_punti, f"modello.fori_da_dst legge {len(segs)} segmenti = {n_punti} punti")

# ---------------------------------------------------------------- blocchi e zone
print("\nZone: punti, coordinate, riquadri")
attesi = [(z, b) for z in desc["zone"] for b in z["blocchi"]]
controlla(len(attesi) == len(blocchi), f"blocchi: letti {len(blocchi)}, JSON {len(attesi)}")
per_zona = {}
for (z, bj), bl in zip(attesi, blocchi):
    per_zona.setdefault(z["id"], []).append(bl)
    ok = (bl["n"] == bj["punti"] and bl["ago"] == bj["ago"] and uguale(bl["punti"][0], bj["primo_mm"])
          and uguale(bl["punti"][-1], bj["ultimo_mm"]) and uguale(riquadro(bl["punti"]), bj["riquadro_mm"]))
    controlla(ok, f"{z['id']} blocco: {bl['n']} punti ago {bl['ago']}, da {bl['punti'][0]} a {bl['punti'][-1]}, riquadro {riquadro(bl['punti'])}")
for z in desc["zone"]:
    pp = [p for b in per_zona[z["id"]] for p in b["punti"]]
    r = riquadro(pp)
    controlla(uguale(r, z["riquadro_mm"]) and sum(b["n"] for b in per_zona[z["id"]]) == z["punti"],
              f"zona {z['id']}: riquadro {r}, {z['punti']} punti")
    controlla(r[0] >= z["riquadro_nominale_mm"][0] - TOL and r[1] >= z["riquadro_nominale_mm"][1] - TOL and
              r[2] <= z["riquadro_nominale_mm"][2] + TOL and r[3] <= z["riquadro_nominale_mm"][3] + TOL,
              f"zona {z['id']}: dentro il riquadro nominale {z['riquadro_nominale_mm']}")

print("\nDistanze (tessuto libero fra zone, croci una per una)")
elementi = [(f"F{i+1}", riquadro(b["punti"])) for i, b in enumerate(per_zona["F"])]
elementi += [(z["id"], z["riquadro_mm"]) for z in desc["zone"] if z["id"] != "F"]
dmin = min((distanza(r1, r2), a, b) for i, (a, r1) in enumerate(elementi) for b, r2 in elementi[i + 1:])
controlla(dmin[0] >= 4.0 - TOL, f"distanza minima {dmin[0]:.2f} mm, fra {dmin[1]} e {dmin[2]}")

# ---------------------------------------------------------------- parametri misurati sul DST
print("\nFermature")
for z in desc["zone"]:
    for b in per_zona[z["id"]]:
        p = b["punti"]
        ing = [round(math.dist(p[i], p[i + 1]), 2) for i in range(4)]
        usc = [round(math.dist(p[-5 + i], p[-4 + i]), 2) for i in range(4)]
        ok = all(0.4 <= l <= 0.61 for l in ing + usc) and p[0] == p[2] == p[4] and p[-1] == p[-3] == p[-5]
        controlla(ok, f"{z['id']}: 4 punti in ingresso {ing}, 4 in uscita {usc}")


def corpo(b):
    return b["punti"][4:-4]


print("\nParametri misurati")
for id_ in ("A", "B"):
    z = next(z for z in desc["zone"] if z["id"] == id_)
    p = corpo(per_zona[id_][0])
    passi = Counter(round(p[i + 1][1] - p[i][1], 2) for i in range(len(p) - 1))
    largh = Counter(round(abs(p[i + 1][0] - p[i][0]), 2) for i in range(len(p) - 1))
    controlla(set(passi) == {0.4} and set(largh) == {z["parametri"]["larghezza_mm"]},
              f"{id_} satin: passo {dict(passi)}, larghezza {dict(largh)}")

for id_, blocco, asse in (("C", 0, 0), ("E", 0, 0), ("E", 1, 1)):
    p = corpo(per_zona[id_][blocco])
    righe = sorted({round(q[1 - asse], 2) for q in p})
    passi = Counter(round(righe[i + 1] - righe[i], 2) for i in range(len(righe) - 1))
    media = (righe[-1] - righe[0]) / (len(righe) - 1)
    lungo = [round(abs(p[i + 1][asse] - p[i][asse]), 2) for i in range(len(p) - 1) if p[i + 1][1 - asse] == p[i][1 - asse]]
    lo, hi = min(q[asse] for q in p), max(q[asse] for q in p)
    fori = sorted({(round(q[asse] * 10) - round(lo * 10)) % 35 / 10 for q in p if lo + 0.05 < q[asse] < hi - 0.05})
    controlla(abs(media - 0.45) < 0.01 and set(passi) <= {0.4, 0.5} and max(lungo) <= 3.5 + 1.0 + TOL,
              f"{id_}{blocco + 1} tatami {'0' if asse == 0 else '90'}°: {len(righe)} righe, passo medio {media:.3f} {dict(passi)}, "
              f"punti lungo riga {dict(Counter(lungo).most_common(4))}, fasi dei fori mod 3,5: {fori}")
e = next(z for z in desc["zone"] if z["id"] == "E")
r1, r2 = riquadro(per_zona["E"][0]["punti"]), riquadro(per_zona["E"][1]["punti"])
sov = [max(r1[0], r2[0]), max(r1[1], r2[1]), min(r1[2], r2[2]), min(r1[3], r2[3])]
controlla(uguale(sov, e["sovrapposizione_mm"]) and round(r2[0] - r1[0], 2) == 5.0 and round(r2[1] - r1[1], 2) == 5.0,
          f"E sovrapposizione {[round(v, 1) for v in sov]} ({sov[2]-sov[0]:.1f} x {sov[3]-sov[1]:.1f} mm), sfalsamento 5/5 mm, ago 2 = {per_zona['E'][1]['ago'] == 2}")

p = corpo(per_zona["D"][0])
denti = [(p[i], p[i - 1]) for i in range(1, len(p) - 1) if p[i - 1] == p[i + 1] and abs(math.dist(p[i], p[i - 1]) - 4.0) < 0.05]
direz = Counter((round(punta[0] - foro[0], 2), round(punta[1] - foro[1], 2)) for punta, foro in denti)   # punta - foro sulla colonna
colonne = sorted({q[0] for q in p if Counter(r[0] for r in p)[q[0]] > 6})
passo_col = Counter(round(colonne[i + 1] - colonne[i], 2) for i in range(len(colonne) - 1))
spina = Counter(round(abs(p[i + 1][1] - p[i][1]), 2) for i in range(len(p) - 1) if p[i + 1][0] == p[i][0] and p[i + 1][1] != p[i][1])
controlla(set(direz) == {(-4.0, 0.0)} and set(passo_col) == {2.2} and set(spina) == {1.1},
          f"D reticolo: {len(denti)} denti andata e ritorno {dict(direz)}, colonne {colonne} passo {dict(passo_col)}, punto colonna {dict(spina)}")

# G: 5 fermature isolate, 4 punti da 0,5 mm negli stessi due fori, a 5 mm l'una dall'altra
g = next(z for z in desc["zone"] if z["id"] == "G")
fg = per_zona["G"]
inizi = [b["punti"][0] for b in fg]
passi_g = Counter(round(inizi[i + 1][0] - inizi[i][0], 2) for i in range(len(inizi) - 1))
fori_g = [sorted({q for q in b["punti"]}) for b in fg]
controlla(len(fg) == g["parametri"]["fermature"] and all(b["n"] == g["parametri"]["punti_per_fermatura"] for b in fg)
          and set(passi_g) == {g["parametri"]["passo_mm"]} and all(len(f) == 2 and abs(math.dist(*f) - 0.5) < 0.01 for f in fori_g)
          and len({q[1] for q in inizi}) == 1,
          f"G fermature: {len(fg)} da {[b['n'] for b in fg]} punti, 2 fori a 0,5 mm ciascuna, passo {dict(passi_g)}")

# H: 8 orizzontali, poi 8 verticali; punto 2 mm; fori delle verticali sulle linee orizzontali, fra i loro fori
hb = per_zona["H"]
oriz, vert = [corpo(b) for b in hb[:8]], [corpo(b) for b in hb[8:]]
y_linee = sorted({q[1] for l in oriz for q in l})
x_fori_o = {q[0] for l in oriz for q in l}
punti_h = Counter(round(math.dist(l[i], l[i + 1]), 2) for l in oriz + vert for i in range(len(l) - 1))
tutte_o = all(len({q[1] for q in l}) == 1 for l in oriz) and all(len({q[0] for q in l}) == 1 for l in vert)
fori_v_interni = [q for l in vert for q in l if y_linee[0] - 0.05 <= q[1] <= y_linee[-1] + 0.05]
sulle_linee = all(any(abs(q[1] - y) < 0.05 for y in y_linee) for q in fori_v_interni)
fra_i_fori = all(all(abs(q[0] - x) > 0.95 for x in x_fori_o) for q in fori_v_interni)
fuori = all(not (y_linee[0] - 0.05 <= l[0][1] <= y_linee[-1] + 0.05) and not (y_linee[0] - 0.05 <= l[-1][1] <= y_linee[-1] + 0.05) for l in vert)
controlla(len(oriz) == 8 and len(vert) == 8 and tutte_o and set(punti_h) == {2.0} and len(y_linee) == 8
          and set(Counter(round(y_linee[i + 1] - y_linee[i], 2) for i in range(7))) == {2.0}
          and sulle_linee and fra_i_fori and fuori,
          f"H incroci: 8 orizzontali poi 8 verticali, punto {dict(punti_h)}, {len(fori_v_interni)} fori verticali "
          f"sulle linee ({sulle_linee}) e a 1 mm dai fori orizzontali ({fra_i_fori}), fermature fuori dagli incroci ({fuori})")

for i, b in enumerate(per_zona["F"]):
    r = riquadro(b["punti"])
    controlla(abs(r[2] - r[0] - 3) < 0.05 and abs(r[3] - r[1] - 3) < 0.05, f"F{i+1} croce {r[2]-r[0]:.1f} x {r[3]-r[1]:.1f} mm, centro ({(r[0]+r[2])/2:.1f}, {(r[1]+r[3])/2:.1f})")

print("\n" + ("TUTTO VERIFICATO" if not falliti else f"{len(falliti)} CONTROLLI FALLITI"))
sys.exit(1 if falliti else 0)
