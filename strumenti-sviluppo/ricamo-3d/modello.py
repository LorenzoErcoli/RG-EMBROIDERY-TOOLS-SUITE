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


def _ventaglio(hf, ax, ay, bx, by, t, corda, r_st, n_scost):
    """Sceglie lo scostamento laterale del punto (forma sin(pi t)) fra n_scost candidati, tutti valutati insieme.

    Restituisce x, y del percorso scelto, l'appoggio letto sull'heightfield e la lunghezza in pianta cumulata.
    """
    v_max = min(P.VENTAGLIO_MAX_MM, P.VENTAGLIO_FRAZ * corda)
    scost = np.linspace(-v_max, v_max, n_scost)
    scost = scost[np.lexsort((scost, np.abs(scost)))]          # dal più piccolo: a parità vince il primo
    ux, uy = (bx - ax) / corda, (by - ay) / corda
    forma = np.sin(math.pi * t)
    X = (ax + (bx - ax) * t)[None, :] - uy * scost[:, None] * forma[None, :]
    Y = (ay + (by - ay) * t)[None, :] + ux * scost[:, None] * forma[None, :]
    app = hf.leggi(X.ravel(), Y.ravel(), r_st).reshape(X.shape)
    centro = (t >= P.VENTAGLIO_BORDO_FRAZ) & (t <= 1 - P.VENTAGLIO_BORDO_FRAZ)
    passi = np.hypot(np.diff(X, axis=1), np.diff(Y, axis=1))
    costo = app[:, centro].mean(axis=1) + P.K_VENTAGLIO * (passi.sum(axis=1) - corda)
    j = int(np.flatnonzero(costo <= costo.min() + 1e-9)[0])
    return X[j], Y[j], app[j], np.r_[0.0, np.cumsum(passi[j])]


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


def simula(segs, offs, filato, strati, mezzo_lato, cucitura="incrementale", progresso=None, ventaglio=True):
    """Una variante. `progresso(k, n)` viene chiamata dopo ogni punto cucito e può sollevare un'eccezione per annullare.
    `ventaglio=False` spegne il ventaglio della cucitura rigida (la cucitura rigida di prima)."""
    n_scost = P.SCOSTAMENTI_N if (ventaglio and cucitura == "rigida") else 1
    if cucitura not in ("incrementale", "rigida"):
        raise ValueError("cucitura: 'incrementale' o 'rigida'")
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

    for k in range(len(segs)):
        a, b = offs[k], offs[k + 1]
        seg_id[a:b] = k
        loc[a:b] = np.arange(b - a)
        nloc[a:b] = b - a

    # --- 2. cucitura ---------------------------------------------------------
    extra = {"compattazione": None, "infilzati": None, "spostamento_laterale_mm": None,
             "iterazioni": None, "punti_non_convergenti": None}
    legato = np.zeros(N, bool)
    foro_legato = np.zeros((N, 2))
    if cucitura == "rigida":
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
            if n_scost > 1:
                x, y, appoggio, s_ = _ventaglio(hf, ax, ay, bx, by, t, corda, r_st, n_scost)
            else:
                appoggio = hf.leggi(x, y, r_st)
                s_ = t * corda
            prof = appoggio + r
            prof[0] = prof[-1] = r                      # il filo entra nel foro
            z = involucro_superiore(s_, prof)          # filo in tensione = teso sopra gli ostacoli
            cucito[a:b] = np.c_[x, y, z]
            # timbro: il filo aggiunge lo spessore schiacciato (2 * r * SCHIACCIAMENTO_FILO) sopra il suo appoggio
            hf.timbra(x[1:-1], y[1:-1], z[1:-1] - r + 2 * r_st, r_st)
            L_cucita[k] = np.linalg.norm(np.diff(cucito[a:b], axis=0), axis=1).sum()
            if progresso is not None:
                progresso(k + 1, len(segs))
    else:
        import cucitura as C
        R_c = C.cuci(segs, offs, seg_id, loc, nloc, r, h_garza, filato, involucro_superiore, progresso=progresso)
        cucito, L_cucita = R_c["pos"], R_c["L_cucita"]
        legato, foro_legato = R_c["legato"], R_c["foro_legato"]
        extra = {"compattazione": R_c["comp"], "infilzati": R_c["infilzati"],
                 "spostamento_laterale_mm": R_c["spostamento_laterale_mm"],
                 "iterazioni": R_c["iterazioni"], "punti_non_convergenti": R_c["punti_non_convergenti"]}

    # --- 3. rimozione garza: forma iniziale con eccesso di filo ------------
    L_obiettivo = L_cucita * (1 - P.ALLUNGAMENTO_RECUPERATO)
    # rientro nel foro: una parte dell'eccesso scivola via dal punto (semplificazione dello scorrimento vero)
    corde = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    L_obiettivo = corde + np.maximum(0.0, L_obiettivo - corde) * (1 - P.RIENTRO_FORO)
    pos = np.zeros((N, 3))
    riposo = np.zeros(len(segs))
    for k, (ax, ay, bx, by) in enumerate(segs):
        a, b = offs[k], offs[k + 1]
        n = b - a
        corda = math.hypot(bx - ax, by - ay)
        L = max(L_obiettivo[k], corda)
        riposo[k] = L / (n - 1)
        th = math.radians(rng.uniform(-P.APERTURA_MAX_GRADI, P.APERTURA_MAX_GRADI))
        ux, uy = (bx - ax) / corda, (by - ay) / corda
        px, py = -uy, ux
        t = np.linspace(0, 1, n)
        bump = np.sin(math.pi * t)
        sopra_garza = np.clip(cucito[a:b, 2] - (h_garza + r), 0, None)  # conserva l'ordine di sovrapposizione
        if cucitura == "rigida" and n_scost <= 1:
            A = (2 * corda / math.pi) * math.sqrt(max(L / corda - 1, 0))
            pos[a:b, 0] = ax + (bx - ax) * t + px * A * math.sin(th) * bump
            pos[a:b, 1] = ay + (by - ay) * t + py * A * math.sin(th) * bump
            pos[a:b, 2] = r + sopra_garza + A * math.cos(th) * bump
        else:
            # si parte da dove la cucitura ha lasciato il filo (spostamenti laterali compresi), garza tolta
            base = np.c_[cucito[a:b, :2], r + sopra_garza]
            L_ora = max(np.linalg.norm(np.diff(base, axis=0), axis=1).sum(), corda)
            A = (2 * L_ora / math.pi) * math.sqrt(max(L / L_ora - 1, 0))
            pos[a:b, 0] = base[:, 0] + px * A * math.sin(th) * bump
            pos[a:b, 1] = base[:, 1] + py * A * math.sin(th) * bump
            pos[a:b, 2] = base[:, 2] + A * math.cos(th) * bump

    libero = (loc > 0) & (loc < nloc - 1)
    inv_m = libero.astype(float)
    ancore = pos[~libero].copy()
    i_legati = np.where(legato & libero)[0]            # infilzati in cucitura: restano sull'asse del foro
    pos[i_legati, :2] = foro_legato[i_legati]
    i_edge = np.where(loc < nloc - 1)[0]
    rest_edge = riposo[seg_id[i_edge]]
    i_mid = np.where(libero)[0]
    # nodi vicini ai fori esclusi dal contatto (i fori sono condivisi)
    passo = riposo[seg_id]
    vicino_foro = np.minimum(loc, nloc - 1 - loc) * passo < 0.6 * d
    attivo = np.where(~vicino_foro)[0]
    # collare di sostegno: i due fori di ogni nodo, per misurarne la distanza in pianta
    foro_a = segs[seg_id][:, 0:2]
    foro_b = segs[seg_id][:, 2:4]
    collare = P.COLLARE_FRAZ * h_garza

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
        # appoggio sul tessuto (rialzato dal collare vicino ai fori), ancore
        if collare > 0:
            dist_foro = np.minimum(np.hypot(pos[:, 0] - foro_a[:, 0], pos[:, 1] - foro_a[:, 1]),
                                   np.hypot(pos[:, 0] - foro_b[:, 0], pos[:, 1] - foro_b[:, 1]))
            pavimento = r + collare * np.maximum(0.0, 1 - dist_foro / P.COLLARE_RAGGIO)
        else:
            pavimento = r
        pos[:, 2] = np.maximum(pos[:, 2], pavimento)
        pos[~libero] = ancore
        if len(i_legati):
            pos[i_legati, :2] = foro_legato[i_legati]

    return {
        "err_lunghezza_pct": float(np.mean((np.array([np.linalg.norm(np.diff(pos[a:b], axis=0), axis=1).sum() for a, b in zip(offs[:-1], offs[1:])]) / np.maximum(L_obiettivo, 1e-9) - 1)) * 100),
        "d": d, "h_garza": h_garza, "cucito": cucito, "rilasciato": pos,
        "eccesso_medio_pct": float(np.mean((L_obiettivo - np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1]))
                                           / np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])) * 100),
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

