"""RG 3D ricamo - modello v0: cucitura su termogarza, rimozione, rilassamento.

Pipeline:
  1. DST -> sequenza fori (punti ago)
  2. cucitura, in ordine di macchina. Incrementale (cucitura.py, predefinita): i fili posati sono nodi
     fisici, l'ago li sposta o li infilza, il filo teso li schiaccia e li sposta di lato con attrito.
     Rigida (--cucitura rigida): ogni punto passa sopra un heightfield di garza + fili già posati.
  3. rimozione garza: lunghezza cucita (meno recupero elastico) su fori fissi, meno la parte
     di eccesso che rientra nel foro (RIENTRO_FORO) -> arco in alto e apertura laterale
  4. rilassamento quasi-statico (position based): lunghezza, flessione,
     contatto filo-filo, appoggio sul tessuto rialzato dal collare ai fori
     (gravità a 0: a questa scala domina la rigidità del filo)
Non è ancora calibrato: vedi parametri.py (DA_MISURARE).
"""
import math
import numpy as np
from scipy.spatial import cKDTree
from dst_reader import read_dst
import solutore as S
import parametri as P


def fori_da_dst(path, con_ago=False):
    """Segmenti (ax, ay, bx, by). Con `con_ago` una quinta colonna: l'ago (1, 2, …, +1 a ogni cambio colore)."""
    _, recs = read_dst(path)
    segs = []  # (ax, ay, bx, by[, ago])
    prev = None
    ago = 1
    for x, y, t in recs:
        if t == "stitch":
            if prev is not None:
                segs.append((prev[0], prev[1], x, y, ago) if con_ago else (prev[0], prev[1], x, y))
            prev = (x, y)
        elif t in ("jump", "color"):
            prev = (x, y) if t == "jump" else None
            if t == "color":
                ago += 1
    return np.array(segs, float).reshape(-1, 5 if con_ago else 4)


def ritaglio(segs, cx, cy, mezzo_lato):
    """Segmenti interamente dentro il quadrato, centrati; le colonne oltre la quarta (es. l'ago) passano intatte."""
    m = ((np.abs(segs[:, 0] - cx) <= mezzo_lato) & (np.abs(segs[:, 1] - cy) <= mezzo_lato) &
         (np.abs(segs[:, 2] - cx) <= mezzo_lato) & (np.abs(segs[:, 3] - cy) <= mezzo_lato))
    s = segs[m].copy()
    s[:, [0, 2]] -= cx
    s[:, [1, 3]] -= cy
    corda = np.hypot(s[:, 2] - s[:, 0], s[:, 3] - s[:, 1])
    return s[corda > 0.15]


def costruisci_nodi(segs, passo):
    """Nodi per segmento: conteggio dipende solo dalla corda -> stessa topologia per ogni variante."""
    offs = [0]
    for ax, ay, bx, by in segs:
        n = max(3, int(math.ceil(math.hypot(bx - ax, by - ay) / passo)) + 1)
        offs.append(offs[-1] + n)
    return np.array(offs)


def _rampa_foro(dist):
    """0 entro RAGGIO_AGO dal foro, 1 oltre 2 * RAGGIO_AGO, lineare in mezzo."""
    return np.clip((dist - P.RAGGIO_AGO) / P.RAGGIO_AGO, 0.0, 1.0)


def garza_locale(dist, h_garza):
    """Garza compressa sotto il filo: h_garza * GARZA_FORO sotto l'ago, h_garza lontano."""
    return h_garza * (P.GARZA_FORO + (1.0 - P.GARZA_FORO) * _rampa_foro(dist))


def forma_collare(dist):
    """0 entro RAGGIO_AGO (l'ago ha tolto la garza), 1 a 2 * RAGGIO_AGO, poi giù fino a 0 a COLLARE_RAGGIO."""
    sale = np.clip((dist - P.RAGGIO_AGO) / P.RAGGIO_AGO, 0.0, 1.0)
    scende = np.clip((P.COLLARE_RAGGIO - dist) / max(P.COLLARE_RAGGIO - 2 * P.RAGGIO_AGO, 1e-9), 0.0, 1.0)
    return np.where(dist <= 2 * P.RAGGIO_AGO, sale, scende)


def _dist_fori(x, y, ax, ay, bx, by):
    return np.minimum(np.hypot(x - ax, y - ay), np.hypot(x - bx, y - by))


class Fili:
    """Nodi già posati dalla cucitura rigida, con una griglia per cercare i vicini (celle di lato d)."""

    def __init__(self, segs, offs, d, mezzo_lato):
        self.segs, self.offs, self.d = segs, offs, d
        self.P = np.zeros((offs[-1], 3))
        self.seg_di = np.repeat(np.arange(len(segs)), np.diff(offs))
        corde = np.maximum(np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1]), 1e-9)
        self.dirs = np.c_[(segs[:, 2] - segs[:, 0]) / corde, (segs[:, 3] - segs[:, 1]) / corde]
        self.fori = np.ascontiguousarray(segs[:, :4], dtype=float)
        self.origine = -(mezzo_lato + 2.0)
        self.cella = d
        n = int(math.ceil(2 * (mezzo_lato + 2.0) / d)) + 1
        self.testa = np.full((n, n), -1)
        self.succ = np.full(offs[-1], -1)
        self.cos_par = math.cos(math.radians(P.PARALLELI_ANGOLO_GRADI))
        self.r_par = d / 2

    def quota(self, X, Y, k, limite):
        """Quota minima del centro del punto k in X, Y sopra i nodi con indice < limite."""
        return S.quota_fili(X, Y, self.dirs[k, 0], self.dirs[k, 1], self.fori[k], self.P, self.seg_di, self.fori,
                            self.dirs, self.succ, self.testa, self.origine, self.cella, limite, self.d,
                            self.cos_par, self.r_par, P.RAGGIO_AGO, STESSO_FORO_MM)

    def tira_giu(self, x, y, z, k, pavimento):
        return S.tira_giu(x, y, z, self.dirs[k, 0], self.dirs[k, 1], self.fori[k], self.P, self.seg_di, self.offs,
                          self.fori, self.dirs, self.succ, self.testa, self.origine, self.cella, self.offs[k], self.d,
                          self.cos_par, self.r_par, P.RAGGIO_AGO, STESSO_FORO_MM, P.TIRO_INCROCIO_FRAZ, pavimento)

    def posa(self, k, x, y, z):
        a, b = self.offs[k], self.offs[k + 1]
        self.P[a:b] = np.c_[x, y, z]
        S.inserisci_griglia(self.P, a + 1, b - 1, self.succ, self.testa, self.origine, self.cella)


STESSO_FORO_MM = 0.2    # due fori più vicini di così sono lo stesso foro


def _appoggio(fili, k, X, Y, ax, ay, bx, by, r, h_garza):
    """Quota minima del centro del filo: sopra i fili posati o sopra la garza (che cala ai fori)."""
    return np.maximum(fili.quota(X, Y, k, fili.offs[k]), garza_locale(_dist_fori(X, Y, ax, ay, bx, by), h_garza) + r)


def _ventaglio(fili, k, ax, ay, bx, by, t, corda, n_scost, r, h_garza):
    """Sceglie lo scostamento laterale del punto (forma sin(pi t)) fra n_scost candidati, tutti valutati insieme.

    Restituisce x, y del percorso scelto e la lunghezza in pianta cumulata.
    """
    v_max = min(P.VENTAGLIO_MAX_MM, P.VENTAGLIO_FRAZ * corda)
    scost = np.linspace(-v_max, v_max, n_scost)
    scost = scost[np.lexsort((scost, np.abs(scost)))]          # dal più piccolo: a parità vince il primo
    ux, uy = (bx - ax) / corda, (by - ay) / corda
    forma = np.sin(math.pi * t)
    X = (ax + (bx - ax) * t)[None, :] - uy * scost[:, None] * forma[None, :]
    Y = (ay + (by - ay) * t)[None, :] + ux * scost[:, None] * forma[None, :]
    app = _appoggio(fili, k, X.ravel(), Y.ravel(), ax, ay, bx, by, r, h_garza).reshape(X.shape)
    centro = (t >= P.VENTAGLIO_BORDO_FRAZ) & (t <= 1 - P.VENTAGLIO_BORDO_FRAZ)
    passi = np.hypot(np.diff(X, axis=1), np.diff(Y, axis=1))
    costo = app[:, centro].mean(axis=1) + P.K_VENTAGLIO * (passi.sum(axis=1) - corda)
    j = int(np.flatnonzero(costo <= costo.min() + 1e-9)[0])
    return X[j], Y[j], np.r_[0.0, np.cumsum(passi[j])]


def involucro_superiore(s, z):
    """Inviluppo convesso superiore del profilo: forma di un filo teso sopra gli ostacoli."""
    hull = []
    for i in range(len(s)):
        while len(hull) >= 2:
            i0, i1 = hull[-2], hull[-1]
            if (s[i1] - s[i0]) * (z[i] - z[i0]) - (z[i1] - z[i0]) * (s[i] - s[i0]) >= 0:
                hull.pop()
            else:
                break
        hull.append(i)
    return np.interp(s, s[hull], z[hull])


def _cuci_rigida(segs, offs, r, d, h_garza, n_scost, mezzo_lato, progresso=None):
    """Cucitura rigida, filo tondo: ogni punto (a ventaglio) passa teso sopra la garza e i fili già posati,
    a un diametro pieno dal centro di quelli che incrocia, e li tira un po' verso il basso dove sotto c'è
    posto (garza che si comprime, vuoti sotto un filo teso). Poi si riposa sopra di loro."""
    fili = Fili(segs, offs, d, mezzo_lato)
    pavimento = h_garza * P.GARZA_FORO + r           # più giù di così un filo tirato non va: garza tutta compressa
    L_cucita = np.zeros(len(segs))
    for k, (ax, ay, bx, by) in enumerate(segs):
        a, b = offs[k], offs[k + 1]
        n = b - a
        t = np.linspace(0, 1, n)
        corda = math.hypot(bx - ax, by - ay)
        if n_scost > 1 and corda > 1e-9:
            x, y, s_ = _ventaglio(fili, k, ax, ay, bx, by, t, corda, n_scost, r, h_garza)
        else:
            x, y, s_ = ax + (bx - ax) * t, ay + (by - ay) * t, t * corda

        def profilo():
            prof = _appoggio(fili, k, x, y, ax, ay, bx, by, r, h_garza)
            prof[0] = prof[-1] = r                     # il filo entra nel foro
            return involucro_superiore(s_, prof)       # filo in tensione = teso sopra gli ostacoli
        z = profilo()
        if fili.tira_giu(x, y, z, k, pavimento):
            z = profilo()
        fili.posa(k, x, y, z)
        if progresso is not None:
            progresso(k + 1, len(segs))
    cucito = fili.P
    for k in range(len(segs)):                         # lunghezze alla fine: i punti tirati giù si allungano
        a, b = offs[k], offs[k + 1]
        L_cucita[k] = np.linalg.norm(np.diff(cucito[a:b], axis=0), axis=1).sum()
    return cucito, L_cucita


def simula(segs, offs, filato, strati, mezzo_lato, cucitura="incrementale", progresso=None, ventaglio=True):
    """Una variante. `progresso(k, n)` viene chiamata dopo ogni punto cucito e può sollevare un'eccezione per annullare.
    `ventaglio=False` spegne il ventaglio della cucitura rigida.

    La cucitura si esegue due volte con la stessa logica: con gli strati scelti e con 0 strati. La seconda è
    lo stato di riposo del rilassamento; il filo in più della prima (meno il rientro nel foro) diventa arco.
    Con 0 strati le due coincidono e la rimozione non muove niente.
    """
    n_scost = P.SCOSTAMENTI_N if (ventaglio and cucitura == "rigida") else 1
    if cucitura not in ("incrementale", "rigida"):
        raise ValueError("cucitura: 'incrementale' o 'rigida'")
    d = P.diametro_filo(P.FILATI[filato]["tex"])
    r = d / 2
    h_garza = strati * P.SPESSORE_GARZA_STRATO * P.COMPRESSIONE_GARZA
    N = offs[-1]
    seg_id = np.zeros(N, int)
    loc = np.zeros(N, int)
    nloc = np.zeros(N, int)
    for k in range(len(segs)):
        a, b = offs[k], offs[k + 1]
        seg_id[a:b] = k
        loc[a:b] = np.arange(b - a)
        nloc[a:b] = b - a
    n_punti = len(segs)
    passate = 1 if h_garza == 0 else 2

    def avanzamento(base):
        if progresso is None:
            return None
        return lambda k, n: progresso(base + k, passate * n)

    # --- 2. cucitura, con la garza e a 0 strati ---------------------------------
    extra = {"compattazione": None, "infilzati": None, "spostamento_laterale_mm": None,
             "iterazioni": None, "punti_non_convergenti": None}
    legato = np.zeros(N, bool)
    foro_legato = np.zeros((N, 2))

    def cuci(h, base):
        if cucitura == "rigida":
            c, L = _cuci_rigida(segs, offs, r, d, h, n_scost, mezzo_lato, avanzamento(base))
            return c, L, {"comp": np.ones(len(c))}         # filo tondo
        import cucitura as C
        R_c = C.cuci(segs, offs, seg_id, loc, nloc, r, h, filato, involucro_superiore, progresso=avanzamento(base))
        return R_c["pos"], R_c["L_cucita"], R_c

    cucito, L_cucita, R_c = cuci(h_garza, 0)
    if cucitura == "incrementale":
        legato, foro_legato = R_c["legato"], R_c["foro_legato"]
        extra = {"compattazione": R_c["comp"], "infilzati": R_c["infilzati"],
                 "spostamento_laterale_mm": R_c["spostamento_laterale_mm"],
                 "iterazioni": R_c["iterazioni"], "punti_non_convergenti": R_c["punti_non_convergenti"]}
    if passate == 1:
        riposo_geo, L_zero, R_zero = cucito, L_cucita, R_c
    else:
        riposo_geo, L_zero, R_zero = cuci(0.0, n_punti)
    if cucitura == "incrementale":                   # infilzati: quelli della cucitura a 0 strati restano sul foro
        legato, foro_legato = R_zero["legato"], R_zero["foro_legato"]

    # --- 3. rimozione garza: riposo a 0 strati + eccesso come arco ---------------
    corde = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    eccesso = np.maximum(0.0, L_cucita - L_zero) * (1 - P.RIENTRO_FORO)
    L_obiettivo = L_zero + eccesso
    scala = L_obiettivo / np.maximum(L_zero, 1e-12)
    i_edge = np.where(loc < nloc - 1)[0]
    rest_edge = np.linalg.norm(riposo_geo[i_edge + 1] - riposo_geo[i_edge], axis=1) * scala[seg_id[i_edge]]
    foro_a = segs[seg_id][:, 0:2]
    foro_b = segs[seg_id][:, 2:4]
    pos = riposo_geo.copy()
    for k, (ax, ay, bx, by) in enumerate(segs):
        if eccesso[k] <= 0:
            continue
        a, b = offs[k], offs[k + 1]
        n = b - a
        L0 = max(L_zero[k], 1e-9)
        A = (2 * L0 / math.pi) * math.sqrt(max(L_obiettivo[k] / L0 - 1, 0))
        ux, uy = (bx - ax) / corde[k], (by - ay) / corde[k]
        px, py = -uy, ux
        # di lato verso cui il punto si è già aperto (ventaglio), altrimenti a sinistra; apertura proporzionale all'eccesso
        scost = float(np.mean((riposo_geo[a:b, 0] - ax) * px + (riposo_geo[a:b, 1] - ay) * py))
        lato = -1.0 if scost < -1e-6 else 1.0
        th = math.radians(P.APERTURA_MAX_GRADI) * min(1.0, (eccesso[k] / L0) / P.APERTURA_ECCESSO_PIENO)
        bump = np.sin(math.pi * np.linspace(0, 1, n))
        pos[a:b, 0] += lato * px * A * math.sin(th) * bump
        pos[a:b, 1] += lato * py * A * math.sin(th) * bump
        pos[a:b, 2] += A * math.cos(th) * bump

    libero = (loc > 0) & (loc < nloc - 1)
    inv_m = libero.astype(float)
    ancore = riposo_geo[~libero].copy()
    i_legati = np.where(legato & libero)[0]            # infilzati in cucitura: restano sull'asse del foro
    pos[i_legati, :2] = foro_legato[i_legati]
    i_mid = np.where(libero)[0]
    # flessione di riposo: la curvatura della cucitura a 0 strati, non il filo dritto
    lap_riposo = (riposo_geo[i_mid - 1] + riposo_geo[i_mid + 1]) / 2 - riposo_geo[i_mid]
    # nodi vicini ai fori esclusi dal contatto (i fori sono condivisi)
    passo = (L_obiettivo / np.maximum(np.diff(offs) - 1, 1))[seg_id]
    vicino_foro = np.minimum(loc, nloc - 1 - loc) * passo < 0.6 * d
    attivo = np.where(~vicino_foro)[0]
    # sezione di contatto: rigida tonda; incrementale quella schiacciata della cucitura a 0 strati (semiassi r/c e r*c)
    c_nodo = np.clip(R_zero["comp"], 0.2, 1.0)
    spessore_nodo = d * c_nodo
    # coppie che si toccano o quasi: le sezioni schiacciate sono larghe r/c
    raggio_ricerca = (float((d / c_nodo[attivo]).max()) + 0.1) if len(attivo) else 0.0
    collare = P.COLLARE_FRAZ * h_garza
    pavimento_base = np.minimum(r, riposo_geo[:, 2])   # un filo compattato può stare più basso di r: è il suo riposo

    # --- 4. rilassamento -----------------------------------------------------
    for it in range(P.ITERAZIONI):
        pos[:, 2] -= P.GRAVITA_PER_ITER * inv_m
        # flessione verso la curvatura di riposo
        lap = (pos[i_mid - 1] + pos[i_mid + 1]) / 2 - pos[i_mid] - lap_riposo
        pos[i_mid] += P.RIGIDEZZA_FLESSIONE * lap
        # contatto filo-filo: chi a riposo sta sopra resta sopra
        if it % 10 == 0:
            tree = cKDTree(pos[attivo])
            pr = tree.query_pairs(raggio_ricerca, output_type="ndarray")
            ci, cj = (attivo[pr[:, 0]], attivo[pr[:, 1]]) if len(pr) else (np.zeros(0, int), np.zeros(0, int))
            diversi = seg_id[ci] != seg_id[cj]
            ci, cj = ci[diversi], cj[diversi]
            s_c = (c_nodo[ci] ** 2 + c_nodo[cj] ** 2) / 2                 # x, y scalati: la sezione diventa tonda
            v0 = (riposo_geo[cj] - riposo_geo[ci]) * np.c_[s_c, s_c, np.ones(len(ci))]
            l0 = np.linalg.norm(v0, axis=1) + 1e-12
            n0 = v0 / l0[:, None]
            # a riposo nessuna spinta: una coppia che nella cucitura a 0 strati stava già più vicina dello
            # spessore (compenetrazioni residue della cucitura) non si separa oltre quella distanza
            dc = np.minimum((spessore_nodo[ci] + spessore_nodo[cj]) / 2, l0)
        if it % 2 == 0 or it > P.ITERAZIONI - 10:
            dp = np.zeros_like(pos)
            cnt = np.zeros(N)
            S.contatto_ordinato(pos, ci, cj, n0, dc, s_c, inv_m, dp, cnt)
            pos += dp / np.maximum(cnt, 1)[:, None] * inv_m[:, None]
        # lunghezza
        for _ in range(P.PASSI_LUNGHEZZA):
            p0, p1 = pos[i_edge], pos[i_edge + 1]
            v = p1 - p0
            l = np.linalg.norm(v, axis=1) + 1e-9
            w0, w1 = inv_m[i_edge], inv_m[i_edge + 1]
            ws = w0 + w1 + 1e-9
            corr = ((l - rest_edge) / l / ws)[:, None] * v
            dp = np.zeros_like(pos)
            cnt = np.zeros(N)
            np.add.at(dp, i_edge, corr * w0[:, None])
            np.add.at(dp, i_edge + 1, -corr * w1[:, None])
            np.add.at(cnt, i_edge, 1)
            np.add.at(cnt, i_edge + 1, 1)
            pos += dp / np.maximum(cnt, 1)[:, None]
        # appoggio sul tessuto (rialzato dal collare attorno ai fori), ancore
        if collare > 0:
            dist_foro = np.minimum(np.hypot(pos[:, 0] - foro_a[:, 0], pos[:, 1] - foro_a[:, 1]),
                                   np.hypot(pos[:, 0] - foro_b[:, 0], pos[:, 1] - foro_b[:, 1]))
            pavimento = pavimento_base + collare * forma_collare(dist_foro)
        else:
            pavimento = pavimento_base
        pos[:, 2] = np.where(libero, np.maximum(pos[:, 2], pavimento), pos[:, 2])
        pos[~libero] = ancore
        if len(i_legati):
            pos[i_legati, :2] = foro_legato[i_legati]

    return {
        "err_lunghezza_pct": float(np.mean((np.array([np.linalg.norm(np.diff(pos[a:b], axis=0), axis=1).sum() for a, b in zip(offs[:-1], offs[1:])]) / np.maximum(L_obiettivo, 1e-9) - 1)) * 100),
        "d": d, "h_garza": h_garza, "cucito": cucito, "cucito_zero": riposo_geo, "rilasciato": pos,
        "eccesso_medio_pct": float(np.mean((L_obiettivo - corde) / corde) * 100),
        "cucitura": cucitura, **extra,
    }


def copertura(pos, offs, d, lato_interno, cella=0.02, rett=None):
    """Frazione dell'area (vista dall'alto) coperta dal filo, bordo escluso.

    `rett` = (x0, y0, x1, y1) misura su un rettangolo invece che sul quadrato di mezzo lato `lato_interno`.
    """
    x0, y0, x1, y1 = rett if rett is not None else (-lato_interno, -lato_interno, lato_interno, lato_interno)
    nx, ny = int((x1 - x0) / cella), int((y1 - y0) / cella)
    g = np.zeros((nx, ny), bool)
    k = max(1, int(d / 2 / cella))
    for a, b in zip(offs[:-1], offs[1:]):
        p = pos[a:b]
        tt = np.linspace(0, 1, max(2, int(np.linalg.norm(p[-1, :2] - p[0, :2]) / cella * 1.5)))
        xs = np.interp(tt * (len(p) - 1), np.arange(len(p)), p[:, 0])
        ys = np.interp(tt * (len(p) - 1), np.arange(len(p)), p[:, 1])
        ix = ((xs - x0) / cella).astype(int)
        iy = ((ys - y0) / cella).astype(int)
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                if dx * dx + dy * dy <= k * k:
                    jx, jy = ix + dx, iy + dy
                    m = (jx >= 0) & (jx < nx) & (jy >= 0) & (jy < ny)
                    g[jx[m], jy[m]] = True
    return float(g.mean())


def altezza_media(pos, offs, r):
    h = [pos[a:b, 2].max() - r for a, b in zip(offs[:-1], offs[1:])]
    return float(np.mean(h)), float(np.percentile(h, 90))


def altezza_bordo(pos, offs, segs, r, distanza=0.4, corda_min=3.5):
    """Altezza media del filo (sopra l'appoggio r) a `distanza` mm in pianta da ciascuno dei due fori,
    sui soli punti con corda più lunga di `corda_min`. None se la zona non ha punti così lunghi."""
    corde = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    h = []
    for k in np.where(corde > corda_min + 1e-9)[0]:
        p = pos[offs[k]:offs[k + 1]]
        for q in (p, p[::-1]):                      # dal foro di partenza e da quello di arrivo
            dist = np.hypot(q[:, 0] - q[0, 0], q[:, 1] - q[0, 1])
            j = int(np.argmax(dist >= distanza))
            if j == 0:
                continue
            f = (distanza - dist[j - 1]) / max(dist[j] - dist[j - 1], 1e-12)
            h.append(q[j - 1, 2] + f * (q[j, 2] - q[j - 1, 2]) - r)
    return float(np.mean(h)) if h else None


def gruppi_fermature(segs, corda_max=0.7, minimo=3):
    """Fermature: almeno `minimo` punti consecutivi e collegati, tutti con corda <= `corda_max` mm."""
    corde = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    gruppi, cur = [], []
    for k in range(len(segs)):
        collegato = k > 0 and np.hypot(*(segs[k, 0:2] - segs[k - 1, 2:4])) < 1e-6
        if corde[k] <= corda_max and (not cur or collegato):
            cur.append(k)
        else:
            if len(cur) >= minimo:
                gruppi.append(cur)
            cur = [k] if corde[k] <= corda_max else []
    if len(cur) >= minimo:
        gruppi.append(cur)
    return gruppi


def altezza_fermature(pos, offs, segs, r):
    """Media, sulle fermature, dell'altezza massima del filo (sopra l'appoggio r). None se non ce ne sono."""
    h = [max(pos[offs[k]:offs[k + 1], 2].max() for k in g) - r for g in gruppi_fermature(segs)]
    return float(np.mean(h)) if h else None


def gruppi_fasci(segs, tolleranza=None, minimo=None):
    """Fasci: gruppi di punti con entrambi i capi entro `tolleranza` mm (in qualunque verso), almeno `minimo`."""
    from scipy.spatial import cKDTree
    tolleranza = P.TOLLERANZA_FORI_FASCIO if tolleranza is None else tolleranza
    minimo = P.FASCIO_MIN_PASSAGGI if minimo is None else minimo
    if len(segs) == 0:
        return []
    capi = np.r_[segs[:, 0:4], segs[:, [2, 3, 0, 1]]]
    quale = np.r_[np.arange(len(segs)), np.arange(len(segs))]
    padre = np.arange(len(segs))

    def radice(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for a, b in cKDTree(capi).query_pairs(tolleranza, p=np.inf, output_type="ndarray"):
        ra, rb = radice(quale[a]), radice(quale[b])
        if ra != rb:
            padre[ra] = rb
    gruppi = {}
    for k in range(len(segs)):
        gruppi.setdefault(radice(k), []).append(k)
    return [g for g in gruppi.values() if len(g) >= minimo]


def misura_fasci(pos, offs, segs, r):
    """Numero di fasci, larghezza massima (ingombro in pianta di traverso al fascio, filo compreso) e altezza
    massima (del filo sopra l'appoggio r) fra i fasci. (0, None, None) se non ce ne sono."""
    gruppi = gruppi_fasci(segs)
    if not gruppi:
        return 0, None, None
    larghezze, altezze = [], []
    for g in gruppi:
        ax, ay, bx, by = segs[g[0]]
        corda = math.hypot(bx - ax, by - ay) or 1.0
        px, py = -(by - ay) / corda, (bx - ax) / corda
        nodi = np.concatenate([pos[offs[k]:offs[k + 1]] for k in g])
        lat = nodi[:, 0] * px + nodi[:, 1] * py
        larghezze.append(float(lat.max() - lat.min()) + 2 * r)
        altezze.append(float(nodi[:, 2].max()) - r)
    return len(gruppi), max(larghezze), max(altezze)

