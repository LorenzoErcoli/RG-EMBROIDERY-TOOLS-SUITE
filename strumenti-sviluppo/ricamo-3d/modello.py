"""RG 3D ricamo - modello v0: cucitura su termogarza, rimozione, rilassamento.

Pipeline:
  1. DST -> sequenza fori (punti ago)
  2. cucitura: ogni punto passa sopra termogarza compressa + fili già posati
     (heightfield aggiornato in ordine di macchina) -> lunghezza cucita
  3. rimozione garza: lunghezza cucita (meno recupero elastico) su fori fissi
     -> eccesso di filo che diventa arco in alto e apertura laterale
  4. rilassamento quasi-statico (position based): lunghezza, flessione,
     contatto filo-filo, appoggio sul tessuto, leggera gravità
Non è ancora calibrato: vedi parametri.py (DA_MISURARE).
"""
import math
import numpy as np
from scipy.spatial import cKDTree
from dst_reader import read_dst
import parametri as P


def fori_da_dst(path):
    _, recs = read_dst(path)
    segs = []  # (ax, ay, bx, by)
    prev = None
    for x, y, t in recs:
        if t == "stitch":
            if prev is not None:
                segs.append((prev[0], prev[1], x, y))
            prev = (x, y)
        elif t in ("jump", "color"):
            prev = (x, y) if t == "jump" else None
    return np.array(segs, float)


def ritaglio(segs, cx, cy, mezzo_lato):
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


class Heightfield:
    def __init__(self, lato, cella, base):
        self.c = cella
        self.o = -lato
        self.n = int(2 * lato / cella) + 1
        self.H = np.full((self.n, self.n), base, float)

    def idx(self, x, y):
        return (np.clip(((x - self.o) / self.c).astype(int), 0, self.n - 1),
                np.clip(((y - self.o) / self.c).astype(int), 0, self.n - 1))

    def leggi(self, x, y, raggio):
        k = max(1, int(raggio / self.c))
        ix, iy = self.idx(x, y)
        best = np.zeros(len(x))
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                if dx * dx + dy * dy <= k * k:
                    best = np.maximum(best, self.H[np.clip(ix + dx, 0, self.n - 1), np.clip(iy + dy, 0, self.n - 1)])
        return best

    def timbra(self, x, y, ztop, raggio):
        k = max(1, int(raggio / self.c))
        ix, iy = self.idx(x, y)
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                if dx * dx + dy * dy <= k * k:
                    jx, jy = np.clip(ix + dx, 0, self.n - 1), np.clip(iy + dy, 0, self.n - 1)
                    np.maximum.at(self.H, (jx, jy), ztop)


def simula(segs, offs, filato, strati, mezzo_lato):
    rng = np.random.default_rng(P.SEME)
    d = P.diametro_filo(P.FILATI[filato]["tex"])
    r = d / 2
    r_st = r * P.SCHIACCIAMENTO_FILO   # mezzo spessore schiacciato sotto tensione
    d_contatto = 2 * r_st             # fili di cotone morbidi: si schiacciano a contatto
    h_garza = strati * P.SPESSORE_GARZA_STRATO * P.COMPRESSIONE_GARZA
    N = offs[-1]
    seg_id = np.zeros(N, int)
    loc = np.zeros(N, int)
    nloc = np.zeros(N, int)

    # --- 2. cucitura ---------------------------------------------------------
    hf = Heightfield(mezzo_lato + 1, 0.04, h_garza)
    cucito = np.zeros((N, 3))
    L_cucita = np.zeros(len(segs))
    for k, (ax, ay, bx, by) in enumerate(segs):
        a, b = offs[k], offs[k + 1]
        n = b - a
        t = np.linspace(0, 1, n)
        x = ax + (bx - ax) * t
        y = ay + (by - ay) * t
        corda = math.hypot(bx - ax, by - ay)
        appoggio = hf.leggi(x, y, r_st)
        s_ = t * corda
        prof = appoggio + r
        prof[0] = prof[-1] = r                      # il filo entra nel foro
        z = involucro_superiore(s_, prof)          # filo in tensione = teso sopra gli ostacoli
        cucito[a:b] = np.c_[x, y, z]
        hf.timbra(x[1:-1], y[1:-1], z[1:-1] - r + 2 * r_st, r_st)
        L_cucita[k] = np.linalg.norm(np.diff(cucito[a:b], axis=0), axis=1).sum()
        seg_id[a:b] = k
        loc[a:b] = np.arange(n)
        nloc[a:b] = n

    # --- 3. rimozione garza: forma iniziale con eccesso di filo ------------
    L_obiettivo = L_cucita * (1 - P.ALLUNGAMENTO_RECUPERATO)
    pos = np.zeros((N, 3))
    riposo = np.zeros(len(segs))
    for k, (ax, ay, bx, by) in enumerate(segs):
        a, b = offs[k], offs[k + 1]
        n = b - a
        corda = math.hypot(bx - ax, by - ay)
        L = max(L_obiettivo[k], corda)
        riposo[k] = L / (n - 1)
        A = (2 * corda / math.pi) * math.sqrt(max(L / corda - 1, 0))
        th = math.radians(rng.uniform(-P.APERTURA_MAX_GRADI, P.APERTURA_MAX_GRADI))
        ux, uy = (bx - ax) / corda, (by - ay) / corda
        px, py = -uy, ux
        t = np.linspace(0, 1, n)
        bump = np.sin(math.pi * t)
        pos[a:b, 0] = ax + (bx - ax) * t + px * A * math.sin(th) * bump
        pos[a:b, 1] = ay + (by - ay) * t + py * A * math.sin(th) * bump
        sopra_garza = np.clip(cucito[a:b, 2] - (h_garza + r), 0, None)  # conserva l'ordine di sovrapposizione
        pos[a:b, 2] = r + sopra_garza + A * math.cos(th) * bump

    libero = (loc > 0) & (loc < nloc - 1)
    inv_m = libero.astype(float)
    ancore = pos[~libero].copy()
    i_edge = np.where(loc < nloc - 1)[0]
    rest_edge = riposo[seg_id[i_edge]]
    i_mid = np.where(libero)[0]
    # nodi vicini ai fori esclusi dal contatto (i fori sono condivisi)
    passo = riposo[seg_id]
    vicino_foro = np.minimum(loc, nloc - 1 - loc) * passo < 1.2 * d
    attivo = np.where(~vicino_foro)[0]

    # --- 4. rilassamento -----------------------------------------------------
    for it in range(P.ITERAZIONI):
        pos[:, 2] -= P.GRAVITA_PER_ITER * inv_m
        # flessione
        lap = (pos[i_mid - 1] + pos[i_mid + 1]) / 2 - pos[i_mid]
        pos[i_mid] += P.RIGIDEZZA_FLESSIONE * lap
        # contatto filo-filo
        if it % 2 == 0 or it > P.ITERAZIONI - 10:
            tree = cKDTree(pos[attivo])
            pr = tree.query_pairs(d_contatto, output_type="ndarray")
            if len(pr):
                i, j = attivo[pr[:, 0]], attivo[pr[:, 1]]
                stesso = (seg_id[i] == seg_id[j]) & (np.abs(loc[i] - loc[j]) <= 3)
                i, j = i[~stesso], j[~stesso]
                v = pos[j] - pos[i]
                l = np.linalg.norm(v, axis=1) + 1e-9
                pen = (d_contatto - l) / 2
                nrm = v / l[:, None]
                dp = np.zeros_like(pos)
                cnt = np.zeros(N)
                np.add.at(dp, i, -nrm * pen[:, None])
                np.add.at(dp, j, nrm * pen[:, None])
                np.add.at(cnt, i, 1)
                np.add.at(cnt, j, 1)
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
        # appoggio sul tessuto, ancore
        pos[:, 2] = np.maximum(pos[:, 2], r)
        pos[~libero] = ancore

    return {
        "err_lunghezza_pct": float(np.mean((np.array([np.linalg.norm(np.diff(pos[a:b], axis=0), axis=1).sum() for a, b in zip(offs[:-1], offs[1:])]) / np.maximum(L_obiettivo, 1e-9) - 1)) * 100),
        "d": d, "h_garza": h_garza, "cucito": cucito, "rilasciato": pos,
        "eccesso_medio_pct": float(np.mean((L_obiettivo - np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1]))
                                           / np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])) * 100),
    }


def copertura(pos, offs, d, lato_interno, cella=0.02):
    """Frazione dell'area (vista dall'alto) coperta dal filo, bordo escluso."""
    n = int(2 * lato_interno / cella)
    g = np.zeros((n, n), bool)
    k = max(1, int(d / 2 / cella))
    for a, b in zip(offs[:-1], offs[1:]):
        p = pos[a:b]
        tt = np.linspace(0, 1, max(2, int(np.linalg.norm(p[-1, :2] - p[0, :2]) / cella * 1.5)))
        xs = np.interp(tt * (len(p) - 1), np.arange(len(p)), p[:, 0])
        ys = np.interp(tt * (len(p) - 1), np.arange(len(p)), p[:, 1])
        ix = ((xs + lato_interno) / cella).astype(int)
        iy = ((ys + lato_interno) / cella).astype(int)
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                if dx * dx + dy * dy <= k * k:
                    jx, jy = ix + dx, iy + dy
                    m = (jx >= 0) & (jx < n) & (jy >= 0) & (jy < n)
                    g[jx[m], jy[m]] = True
    return float(g.mean())


def altezza_media(pos, offs, r):
    h = [pos[a:b, 2].max() - r for a, b in zip(offs[:-1], offs[1:])]
    return float(np.mean(h)), float(np.percentile(h, 90))
