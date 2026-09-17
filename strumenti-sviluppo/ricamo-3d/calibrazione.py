"""DST di calibrazione per il modello ricamo-3d: campioni reali da confrontare con la simulazione.

Uso (dalla cartella del modulo):
    python calibrazione.py            -> scrive calibrazione/calibrazione.dst, _zone.json, _anteprima.png
    python verifica_calibrazione.py   -> rilegge il DST con dst_reader.py e lo confronta col JSON

Tutte le coordinate si calcolano direttamente in decimi di millimetro interi (l'unità del DST):
il JSON descrive quindi esattamente i punti che vanno in macchina, senza un secondo arrotondamento.
Sistema cartesiano, y verso l'alto, origine al centro dell'area. Nessun sottopunto in nessuna zona.
Il formato dell'header è lo stesso di `buildDst` in packages/core/src/dst.ts.
"""
import json
import math
from pathlib import Path

QUI = Path(__file__).parent
USCITA = QUI / "calibrazione"

AREA_LARGHEZZA_MM = 45.0         # l'altezza segue le zone: con G e H l'area è 45 x 62 mm
MAX_RECORD = 121                  # 12,1 mm: nessun record (punto o salto) più lungo, in norma euclidea
FERMATURA = {"punti": 4, "lunghezza_mm": 0.5,
             "come": "avanti e indietro lungo il primo punto (inizio) e lungo l'ultimo (fine)"}
SATIN = {"passo_mm": 0.40, "lunghezza_mm": 15.0}
TATAMI = {"passo_righe_mm": 0.45, "lunghezza_punto_mm": 3.5, "sfalsamento": 1 / 3,
          "punto_minimo_bordo_mm": 1.0}
FERMATURE_G = {"fermature": 5, "passo_mm": 5.0}
INCROCI_H = {"linee": 8, "punto_mm": 2.0, "passo_linee_mm": 2.0}
RETICOLO = {"passo_colonne_mm": 2.2, "punto_colonna_mm": 1.1, "dente_mm": 4.0,
            "denti_ogni_punti_colonna": 2, "sfasamento_colonne_mm": 1.1, "direzione_denti": "-x"}


def dm(v):
    """mm -> decimi interi, arrotondamento a metà verso l'alto (niente arrotondamento bancario)."""
    return int(math.floor(v * 10 + 0.5))


# ---------------------------------------------------------------- geometrie (decimi, origine locale)

def satin(larghezza_mm):
    """Colonna verticale a zig-zag: una passata ogni 0,40 mm lungo y, nessun sottopunto."""
    w, passo = dm(larghezza_mm), dm(SATIN["passo_mm"])
    n = int(dm(SATIN["lunghezza_mm"]) // passo)          # 15 / 0,4 = 37 passate -> 14,8 mm
    return [(0 if k % 2 == 0 else w, k * passo) for k in range(n + 1)]


def tatami(lato_u_mm, lato_v_mm, angolo):
    """Righe a serpentina; angolo 0 = righe lungo x, 90 = righe lungo y. Sfalsamento assoluto (a mattone)."""
    L, Lv = dm(lato_u_mm), dm(lato_v_mm)
    p = TATAMI["lunghezza_punto_mm"]
    minimo = TATAMI["punto_minimo_bordo_mm"]
    punti = []
    r = 0
    while dm(r * TATAMI["passo_righe_mm"]) <= Lv:
        v = dm(r * TATAMI["passo_righe_mm"])
        fase = (r % 3) * TATAMI["sfalsamento"] * p
        interni, u = [], fase
        while u < lato_u_mm:
            if u >= minimo and lato_u_mm - u >= minimo:
                interni.append(dm(u))
            u += p
        riga = [0] + interni + [L]
        if r % 2 == 1:
            riga.reverse()
        punti += [(u_, v) for u_ in riga]
        r += 1
    if angolo == 90:
        punti = [(v, u) for u, v in punti]
    elif angolo != 0:
        raise ValueError("angolo supportato: 0 o 90")
    return punti, r


def reticolo(lato_mm):
    """Il reticolo di pattern (1).dst: colonne verticali a serpentina, denti andata e ritorno negli stessi fori."""
    passo_col, passo_y, dente = dm(RETICOLO["passo_colonne_mm"]), dm(RETICOLO["punto_colonna_mm"]), dm(RETICOLO["dente_mm"])
    L = dm(lato_mm)
    n_col = (L - dente) // passo_col + 1                  # i denti della prima colonna restano nell'area
    n_y = L // passo_y                                     # 12 / 1,1 -> 10 punti colonna, 11,0 mm
    punti = []
    for c in range(n_col):
        x = dente + c * passo_col
        idx = range(n_y + 1) if c % 2 == 0 else range(n_y, -1, -1)
        for i in idx:
            y = L - i * passo_y                            # indice contato dall'alto, come nel file vero
            punti.append((x, y))
            if (i + c) % RETICOLO["denti_ogni_punti_colonna"] == 0:   # colonne vicine sfasate di 1,1 mm
                punti += [(x - dente, y), (x, y)]
    return punti, n_col


def fermatura_isolata():
    """La fermatura del file (FERMATURA) da sola: avanti e indietro lungo +x, sempre negli stessi due fori."""
    q = dm(FERMATURA["lunghezza_mm"])
    return [(0, 0), (q, 0)] * (FERMATURA["punti"] // 2) + [(0, 0)]


def incroci():
    """8 linee orizzontali in punto corsa, poi 8 verticali sopra. I fori delle verticali cadono sulle linee
    orizzontali (y ogni 2 mm) ma a metà fra i loro fori (x dispari): l'ago prende il filo, non il foro.
    Le verticali sono prolungate di un punto sopra e sotto, così le loro fermature stanno fuori dagli incroci."""
    passo, punto, n = dm(INCROCI_H["passo_linee_mm"]), dm(INCROCI_H["punto_mm"]), INCROCI_H["linee"]
    lato_x = (n) * punto                                   # 0..16 mm: le orizzontali sporgono dalle verticali
    orizzontali, verticali = [], []
    for j in range(n):
        riga = [(i * punto, j * passo) for i in range(lato_x // punto + 1)]
        orizzontali.append(riga if j % 2 == 0 else riga[::-1])
    for i in range(n):
        x = punto // 2 + i * passo
        col = [(x, y) for y in range(-punto, (n - 1) * passo + punto + 1, punto)]
        verticali.append(col if i % 2 == 0 else col[::-1])
    return orizzontali, verticali


def croce(braccio_mm=1.5):
    """Punto corsa, ogni braccio andata e ritorno: stessa quantità di filo sui quattro bracci."""
    b = dm(braccio_mm)
    return [(0, 0), (b, 0), (0, 0), (-b, 0), (0, 0), (0, b), (0, 0), (0, -b), (0, 0)]


# ---------------------------------------------------------------- fermatura e impaginazione

def con_fermatura(punti):
    def passetto(da, verso):
        dx, dy = verso[0] - da[0], verso[1] - da[1]
        l = math.hypot(dx, dy)
        k = dm(FERMATURA["lunghezza_mm"]) / l
        return (da[0] + round(dx * k), da[1] + round(dy * k))
    a, b = punti[0], punti[1]
    z, y = punti[-1], punti[-2]
    ingresso = [a, passetto(a, b)] * (FERMATURA["punti"] // 2)
    uscita = [z, passetto(z, y)] * (FERMATURA["punti"] // 2)
    return ingresso + punti + uscita[1:] + [z]


def riquadro(punti):
    xs, ys = [p[0] for p in punti], [p[1] for p in punti]
    return [min(xs), min(ys), max(xs), max(ys)]


def centra(blocchi, centro_mm):
    """Sposta un gruppo di blocchi perché il loro riquadro sia centrato in `centro_mm` (in decimi interi)."""
    x0, y0, x1, y1 = riquadro([p for b in blocchi for p in b])
    dx = dm(centro_mm[0]) - (x0 + x1) // 2
    dy = dm(centro_mm[1]) - (y0 + y1) // 2
    return [[(x + dx, y + dy) for x, y in b] for b in blocchi]


def mm(v):
    return round(v / 10, 1)


def costruisci():
    """Zone nell'ordine di macchina: F (4 croci), A, B, C, D, G, H, E1 | cambio colore | E2."""
    zone = []

    def zona(id_, nome, tipo, nominale, blocchi, parametri, aghi):
        zone.append({"id": id_, "nome": nome, "tipo": tipo, "riquadro_nominale_mm": nominale,
                     "blocchi_grezzi": blocchi, "aghi": aghi, "parametri": parametri})

    # Riquadri nominali [x0, y0, x1, y1] mm, prima della centratura finale. Riga alta y 2,5..17,5;
    # fila di fermature G a y -1,5; riga bassa y -17,5..-5,5; incroci H y -39,5..-21,5; croci agli angoli.
    # Distanza minima fra riquadri: 4 mm (verificata). Alla fine tutto si sposta per centrare l'area.
    nomA = [-15.5, 2.5, -13.5, 17.5]
    nomB = [-9.5, 2.5, -3.5, 17.5]
    nomE = [0.5, 2.5, 15.5, 17.5]
    nomC = [-15.5, -17.5, -3.5, -5.5]
    nomD = [3.5, -17.5, 15.5, -5.5]
    nomG = [-10.0, -1.5, 10.5, -1.5]
    nomH = [-8.0, -39.5, 8.0, -21.5]
    centri_croci = [(-21, 21), (21, 21), (21, -38), (-21, -38)]

    def centro(n):
        return ((n[0] + n[2]) / 2, (n[1] + n[3]) / 2)

    croci = []
    for cx, cy in centri_croci:
        croci += centra([croce()], (cx, cy))
    zona("F", "Riferimenti", "croci_corsa", [-22.5, -39.5, 22.5, 22.5], croci,
         {"croci": 4, "lato_mm": 3.0, "braccio_mm": 1.5, "lunghezza_punto_mm": 1.5,
          "percorso": "centro -> braccio -> centro, per i quattro bracci (ogni braccio cucito due volte)",
          "centri_mm": [list(c) for c in centri_croci]}, [1])

    zona("A", "Satin stretto", "satin", nomA, centra([satin(2.0)], centro(nomA)),
         {"larghezza_mm": 2.0, "lunghezza_nominale_mm": 15.0, "passo_mm": 0.40, "orientamento": "colonna lungo y, punti lungo x",
          "passo_definizione": "distanza lungo y fra due passate consecutive (R22: fra file adiacenti)", "sottopunto": None}, [1])
    zona("B", "Satin largo", "satin", nomB, centra([satin(6.0)], centro(nomB)),
         {"larghezza_mm": 6.0, "lunghezza_nominale_mm": 15.0, "passo_mm": 0.40, "orientamento": "colonna lungo y, punti lungo x",
          "passo_definizione": "distanza lungo y fra due passate consecutive (R22: fra file adiacenti)", "sottopunto": None}, [1])

    pC, righeC = tatami(12, 12, 0)
    zona("C", "Riempimento tatami", "tatami", nomC, centra([pC], centro(nomC)),
         {"lato_nominale_mm": [12, 12], "passo_righe_mm": 0.45, "lunghezza_punto_mm": 3.5, "sfalsamento": "1/3",
          "angolo_gradi": 0, "righe": righeC, "punto_minimo_bordo_mm": TATAMI["punto_minimo_bordo_mm"],
          "nota_quantizzazione": "DST a 0,1 mm: le righe distano 0,4 o 0,5 mm alternati (media 0,45); fori sfalsati di 0 / 1,2 / 2,3 mm (1/3 e 2/3 di 3,5 arrotondati)", "sottopunto": None}, [1])

    pD, colD = reticolo(12)
    zona("D", "Passaggi doppi", "reticolo_denti", nomD, centra([pD], centro(nomD)),
         dict(RETICOLO, lato_nominale_mm=[12, 12], colonne=colD,
              origine="reticolo di pattern (1).dst", sottopunto=None), [1])

    ferm = []
    for i in range(FERMATURE_G["fermature"]):   # posizionate a mano: centrare arrotonderebbe di un decimo
        ox, oy = dm(nomG[0] + i * FERMATURE_G["passo_mm"]), dm(nomG[1])
        ferm.append([(x + ox, y + oy) for x, y in fermatura_isolata()])
    zona("G", "Fermature", "fermature_isolate", nomG, ferm,
         {"fermature": FERMATURE_G["fermature"], "passo_mm": FERMATURE_G["passo_mm"], "punti_per_fermatura": FERMATURA["punti"],
          "lunghezza_punto_mm": FERMATURA["lunghezza_mm"], "direzione": "+x, avanti e indietro negli stessi due fori",
          "definizione": "la stessa fermatura usata all'inizio e alla fine di ogni blocco del file (FERMATURA): il DST "
                         "non può comandare le fermature automatiche della macchina",
          "sottopunto": None}, [1])
    oriz, vert = incroci()
    blocchi_h = centra(oriz + vert, ((nomH[0] + nomH[2]) / 2, (nomH[1] + nomH[3]) / 2))
    zona("H", "Incroci", "incroci_corsa", nomH, blocchi_h,
         {"linee_orizzontali": INCROCI_H["linee"], "linee_verticali": INCROCI_H["linee"], "punto_mm": INCROCI_H["punto_mm"],
          "passo_linee_mm": INCROCI_H["passo_linee_mm"], "ordine": "prima le 8 orizzontali, poi le 8 verticali sopra",
          "orizzontali": "lunghe 16 mm, fori ogni 2 mm",
          "verticali": "a metà fra i fori delle orizzontali (1 mm), fori sulle linee orizzontali; prolungate di un punto "
                       "sopra e sotto perché le fermature stiano fuori dagli incroci",
          "incroci": INCROCI_H["linee"] * INCROCI_H["linee"], "sottopunto": None}, [1] * (2 * INCROCI_H["linee"]))

    pE1, righeE1 = tatami(10, 10, 0)
    pE2, righeE2 = tatami(10, 10, 90)
    pE2 = [(x + dm(5), y + dm(5)) for x, y in pE2]
    e1, e2 = centra([pE1, pE2], centro(nomE))
    zona("E", "Sovrapposizione", "tatami_sovrapposto", nomE, [e1, e2],
         {"strato_1": {"lato_nominale_mm": [10, 10], "angolo_gradi": 0, "righe": righeE1, "ago": 1},
          "strato_2": {"lato_nominale_mm": [10, 10], "angolo_gradi": 90, "righe": righeE2, "ago": 2,
                       "sfalsamento_mm": [5, 5]},
          "cambio_colore": "fra strato_1 e strato_2",
          "passo_righe_mm": 0.45, "lunghezza_punto_mm": 3.5, "sfalsamento": "1/3", "punto_minimo_bordo_mm": TATAMI["punto_minimo_bordo_mm"],
          "nota_quantizzazione": "come la zona C; ogni strato copre 10 x 9,9 mm (23 righe), quindi la sovrapposizione è 5 x 4,9 mm", "sottopunto": None}, [1, 2])

    # fermatura su ogni blocco (le croci sono blocchi separati da salti: ognuna ha la sua);
    # le fermature di G sono già il blocco intero
    for z in zone:
        grezzi = z.pop("blocchi_grezzi")
        z["blocchi"] = grezzi if z["id"] == "G" else [con_fermatura(b) for b in grezzi]
    # centratura dell'area: tutto si sposta di un numero intero di decimi
    tutti = [p for z in zone for b in z["blocchi"] for p in b]
    x0, y0, x1, y1 = riquadro(tutti)
    dx, dy = -(x0 + x1) // 2, -(y0 + y1) // 2
    for z in zone:
        z["blocchi"] = [[(x + dx, y + dy) for x, y in b] for b in z["blocchi"]]
        n = z["riquadro_nominale_mm"]
        z["riquadro_nominale_mm"] = [round(n[0] + dx / 10, 1), round(n[1] + dy / 10, 1), round(n[2] + dx / 10, 1), round(n[3] + dy / 10, 1)]
        if z["id"] == "F":
            z["parametri"]["centri_mm"] = [[round(cx + dx / 10, 1), round(cy + dy / 10, 1)] for cx, cy in z["parametri"]["centri_mm"]]
    return zone


# ---------------------------------------------------------------- DST

def record(dx, dy, tipo):
    b = [0, 0, 0x03]
    bit_x = {1: (0, 0), -1: (0, 1), 9: (0, 2), -9: (0, 3), 3: (1, 0), -3: (1, 1), 27: (1, 2), -27: (1, 3), 81: (2, 2), -81: (2, 3)}
    bit_y = {1: (0, 7), -1: (0, 6), 9: (0, 5), -9: (0, 4), 3: (1, 7), -3: (1, 6), 27: (1, 5), -27: (1, 4), 81: (2, 5), -81: (2, 4)}
    for valore, bits in ((dx, bit_x), (dy, bit_y)):
        if not -121 <= valore <= 121:
            raise ValueError(f"delta DST fuori range: {valore}")
        resto = valore
        for w in (81, 27, 9, 3, 1):
            if resto > w / 2:
                i, bit = bits[w]; b[i] |= 1 << bit; resto -= w
            elif resto < -w / 2:
                i, bit = bits[-w]; b[i] |= 1 << bit; resto += w
        assert resto == 0
    if tipo == "jump":
        b[2] |= 0x80
    elif tipo == "color":
        b[2] |= 0xC0
    return bytes(b)


def spezza(dx, dy):
    """Divide un movimento in passi uguali, ognuno lungo al massimo 12,1 mm in norma euclidea."""
    n = max(1, math.ceil(math.hypot(dx, dy) / MAX_RECORD))
    while True:   # arrotondando al decimo un passo può superare il limite: se succede, un passo in più
        passi = [(round(dx * k / n) - round(dx * (k - 1) / n), round(dy * k / n) - round(dy * (k - 1) / n)) for k in range(1, n + 1)]
        if all(math.hypot(*s) <= MAX_RECORD for s in passi):
            break
        n += 1
    return passi


def scrivi_dst(zone, etichetta="CALIBRAZ 3D"):
    corpo = bytearray()
    cur = (0, 0)
    ago = None
    n_punti = n_cambi = 0
    tutti = []
    for z in zone:
        for bi, blocco in enumerate(z["blocchi"]):
            ago_blocco = z["aghi"][min(bi, len(z["aghi"]) - 1)]
            if ago is not None and ago_blocco != ago:
                corpo += record(0, 0, "color"); n_cambi += 1
            ago = ago_blocco
            for sx, sy in spezza(blocco[0][0] - cur[0], blocco[0][1] - cur[1]):
                corpo += record(sx, sy, "jump")
            cur = blocco[0]
            for p in blocco[1:]:
                passi = spezza(p[0] - cur[0], p[1] - cur[1])
                assert len(passi) == 1, "un punto di cucitura supera 12,1 mm"
                corpo += record(*passi[0], "stitch"); n_punti += 1
                cur = p
                tutti.append(p)
    corpo += bytes([0x00, 0x00, 0xF3])
    xs, ys = [p[0] for p in tutti], [p[1] for p in tutti]

    def campo(nome, v, w):
        return f"{nome}:{str(v)[:w].rjust(w)}\r"

    def segnato(nome, v, w):
        return f"{nome}:{'-' if v < 0 else '+'}{str(abs(v)).zfill(w - 1)}\r"
    testo = (f"LA:{etichetta[:16].ljust(16)}\r" + campo("ST", n_punti, 7) + campo("CO", n_cambi, 3) +
             segnato("+X", max(0, max(xs)), 5) + segnato("-X", abs(min(0, min(xs))), 5) +
             segnato("+Y", max(0, max(ys)), 5) + segnato("-Y", abs(min(0, min(ys))), 5) +
             segnato("AX", cur[0], 6) + segnato("AY", cur[1], 6) + segnato("MX", 0, 6) + segnato("MY", 0, 6) +
             "PD:******\r")
    header = bytearray(b" " * 512)
    header[:len(testo)] = testo.encode("ascii")
    header[len(testo)] = 0x1A
    return bytes(header) + bytes(corpo), n_punti, n_cambi


# ---------------------------------------------------------------- JSON

def descrizione_json(zone, n_punti, n_cambi):
    out_zone = []
    for z in zone:
        tutti = [p for b in z["blocchi"] for p in b]
        blocchi = []
        for bi, b in enumerate(z["blocchi"]):
            blocchi.append({"ago": z["aghi"][min(bi, len(z["aghi"]) - 1)],
                            "punti": len(b) - 1,       # record-punto: il primo foro si raggiunge col salto
                            "primo_mm": [mm(b[0][0]), mm(b[0][1])], "ultimo_mm": [mm(b[-1][0]), mm(b[-1][1])],
                            "riquadro_mm": [mm(v) for v in riquadro(b)]})
        x0, y0, x1, y1 = riquadro(tutti)
        extra = {}
        if len(z["blocchi"]) == 2 and z["id"] == "E":
            r1, r2 = riquadro(z["blocchi"][0]), riquadro(z["blocchi"][1])
            s = [max(r1[0], r2[0]), max(r1[1], r2[1]), min(r1[2], r2[2]), min(r1[3], r2[3])]
            extra = {"sovrapposizione_mm": [mm(v) for v in s], "sovrapposizione_dimensioni_mm": [mm(s[2] - s[0]), mm(s[3] - s[1])]}
        out_zone.append({"id": z["id"], "nome": z["nome"], "tipo": z["tipo"],
                         "riquadro_mm": [mm(x0), mm(y0), mm(x1), mm(y1)],
                         "dimensioni_mm": [mm(x1 - x0), mm(y1 - y0)],
                         "riquadro_nominale_mm": z["riquadro_nominale_mm"],
                         "punti": sum(b["punti"] for b in blocchi), **extra,
                         "parametri": z["parametri"], "blocchi": blocchi})
    tutti = [p for z in zone for b in z["blocchi"] for p in b]
    x0, y0, x1, y1 = riquadro(tutti)
    return {
        "file": "calibrazione.dst",
        "descrizione": "Campioni di calibrazione per ricamo-3d: stesso file per cotone 30 e cotone 40, su 0/1/2 strati di termogarza.",
        "unita_dst_mm": 0.1,
        "coordinate": "cartesiane, mm, y verso l'alto, origine al centro dell'area (come le legge dst_reader.py)",
        "area_nominale_mm": [mm(x1 - x0), mm(y1 - y0)],
        "riquadro_totale_mm": [mm(x0), mm(y0), mm(x1), mm(y1)],
        "punti_totali": n_punti,
        "cambi_colore": n_cambi,
        "ordine_macchina": [z["id"] for z in zone],
        "sottopunto": "nessuno, in nessuna zona",
        "fermatura": FERMATURA,
        "salti": "fra una zona e l'altra (e fra le croci), spezzati in record da massimo 12,1 mm",
        "distanza_minima_fra_zone_mm": 4.0,
        "zone": out_zone,
    }


# ---------------------------------------------------------------- anteprima PNG

def anteprima(zone, percorso, px_mm=28, margine_mm=7):
    from PIL import Image, ImageDraw, ImageFont
    ax0, ay0, ax1, ay1 = [v / 10 for v in riquadro([p for z in zone for b in z["blocchi"] for p in b])]
    AW, AH = ax1 - ax0, ay1 - ay0
    img = Image.new("RGB", (int((AW + 2 * margine_mm) * px_mm), int((AH + 2 * margine_mm) * px_mm) + 60), (250, 249, 246))
    g = ImageDraw.Draw(img)

    def P(p):   # decimi -> pixel (y verso il basso)
        return ((p[0] / 10 - ax0 + margine_mm) * px_mm, (ay1 + margine_mm - p[1] / 10) * px_mm + 60)

    def Pmm(x, y):
        return P((x * 10, y * 10))

    font = lambda s: ImageFont.load_default(size=s)
    colori = {1: (38, 70, 120), 2: (196, 98, 30)}
    # area totale
    g.rectangle([Pmm(ax0, ay1), Pmm(ax1, ay0)], outline=(200, 200, 195), width=1)
    # salti
    cur = (0, 0)
    for z in zone:
        for b in z["blocchi"]:
            a, c = P(cur), P(b[0])
            n = max(1, int(math.dist(a, c) / 10))
            for k in range(0, n, 2):
                g.line([(a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n),
                        (a[0] + (c[0] - a[0]) * (k + 1) / n, a[1] + (c[1] - a[1]) * (k + 1) / n)], fill=(225, 120, 120), width=1)
            cur = b[-1]
    # riquadri nominali e punti
    for z in zone:
        if z["id"] != "F":
            x0, y0, x1, y1 = z["riquadro_nominale_mm"]
            g.rectangle([Pmm(x0, y1), Pmm(x1, y0)], outline=(170, 170, 165), width=1)
        for bi, b in enumerate(z["blocchi"]):
            col = colori[z["aghi"][min(bi, len(z["aghi"]) - 1)]]
            g.line([P(p) for p in b], fill=col, width=1)
            for p in b:
                x, y = P(p)
                g.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col)
    # etichette
    for z in zone:
        tutti = [p for b in z["blocchi"] for p in b]
        x0, y0, x1, y1 = riquadro(tutti)
        if z["id"] == "F":
            for b in z["blocchi"]:
                bx0, by0, bx1, by1 = riquadro(b)
                cx, cy = P(((bx0 + bx1) / 2, by0))
                g.text((cx, cy + 6), "F", fill=(60, 60, 60), font=font(20), anchor="mt")
            continue
        d = f"{mm(x1 - x0):g} x {mm(y1 - y0):g} mm"
        if z["id"] == "G":
            px, py = P((x1, y0))
            g.text((px + 14, py), "G · fermature", fill=(30, 30, 30), font=font(19), anchor="lm")
            continue
        if z["id"] in ("C", "D", "H"):
            px, py = P(((x0 + x1) / 2, y0))
            g.text((px, py + 8), f"{z['id']} · {z['nome']}", fill=(30, 30, 30), font=font(19), anchor="mt")
            g.text((px, py + 32), d, fill=(110, 110, 110), font=font(15), anchor="mt")
        else:
            px, py = P(((x0 + x1) / 2, y1))
            g.text((px, py - 30), z["id"], fill=(30, 30, 30), font=font(24), anchor="mb")
            g.text((px, py - 8), d, fill=(110, 110, 110), font=font(14), anchor="mb")
    # nomi A, B, E in legenda (le colonne sono strette per il testo)
    g.text((16, 14), f"Calibrazione ricamo-3d · {AW:g} x {AH:g} mm · nessun sottopunto · un punto = un foro", fill=(30, 30, 30), font=font(22))
    g.text((16, 42), "A satin 2 mm · B satin 6 mm · C tatami 0° · D passaggi doppi · E tatami 0° + 90° (ago 2 in arancio) · "
                     "F croci · G 5 fermature · H incroci", fill=(90, 90, 90), font=font(14))
    # barra 10 mm
    bx, by = Pmm(ax0, ay0 - 4)
    g.line([(bx, by), (bx + 10 * px_mm, by)], fill=(30, 30, 30), width=3)
    g.text((bx + 5 * px_mm, by + 6), "10 mm", fill=(30, 30, 30), font=font(14), anchor="mt")
    img.save(percorso)


def main():
    zone = costruisci()
    dati, n_punti, n_cambi = scrivi_dst(zone)
    USCITA.mkdir(exist_ok=True)
    (USCITA / "calibrazione.dst").write_bytes(dati)
    desc = descrizione_json(zone, n_punti, n_cambi)
    (USCITA / "calibrazione_zone.json").write_text(json.dumps(desc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    anteprima(zone, USCITA / "calibrazione_anteprima.png")
    print(f"calibrazione.dst: {n_punti} punti, {n_cambi} cambio colore, {len(dati)} byte")
    for z in desc["zone"]:
        print(f"  {z['id']} {z['nome']:<20} {z['punti']:>5} punti  riquadro {z['riquadro_mm']}  {z['dimensioni_mm']} mm")


if __name__ == "__main__":
    main()
