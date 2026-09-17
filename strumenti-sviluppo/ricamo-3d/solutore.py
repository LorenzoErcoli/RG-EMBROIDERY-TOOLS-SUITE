"""Rilassamento locale di un punto, compilato con numba (Gauss-Seidel).

Stessi vincoli del rilassamento in cucitura.py (flessione, lunghezza con il filo in cucitura che si
tende verso la corda, contatto comprimibile a sezione ellittica con attrito coulombiano, appoggio sulla
garza, nodi infilzati sul foro), ma applicati uno alla volta: ogni correzione vede subito le precedenti.
Il metodo mediato (Jacobi) divide ogni correzione per il numero di vincoli del nodo e, dove i contatti
sono tanti, arriva all'equilibrio di pochi µm a iterazione; questo ci arriva in molte meno iterazioni.
Tutti gli array sono locali all'intorno del punto (indici 0..L-1).
"""
import math
import numpy as np
from numba import njit


@njit(cache=True)
def _compattazione(carico, c_min, carico_ref):
    if carico < 0.0:
        carico = 0.0
    return c_min + (1.0 - c_min) * math.exp(-carico / carico_ref)


@njit(cache=True)
def _raggio(Q, i, prec, succ, nx, ny, nz, r, c):
    """Raggio della sezione ellittica del nodo i nella direzione (nx, ny, nz), letto nel piano della sezione."""
    tx = Q[succ[i], 0] - Q[prec[i], 0]
    ty = Q[succ[i], 1] - Q[prec[i], 1]
    tz = Q[succ[i], 2] - Q[prec[i], 2]
    tl = math.sqrt(tx * tx + ty * ty + tz * tz) + 1e-12
    tx /= tl; ty /= tl; tz /= tl
    lx, ly, lz = -ty, tx, 0.0
    ll = math.sqrt(lx * lx + ly * ly)
    if ll > 1e-6:
        lx /= (ll + 1e-12); ly /= (ll + 1e-12)
    else:
        lx, ly, lz = 1.0, 0.0, 0.0
    bx = ty * lz - tz * ly
    by = tz * lx - tx * lz
    bz = tx * ly - ty * lx
    ns = nx * lx + ny * ly + nz * lz
    nb = nx * bx + ny * by + nz * bz
    nn = math.sqrt(ns * ns + nb * nb) + 1e-12
    a = r / c * ns / nn
    b = r * c * nb / nn
    return math.sqrt(a * a + b * b)


@njit(cache=True)
def rilassa(Q, Cl, riposo, sov, w, prec, succ, seg, lati, flessi, na, nb, corda, ritiro,
            ci, cj, carico_idx, legati, fori, T, r, h_garza, mu_s, mu_k, rigidezza, c_min, carico_ref,
            passi_lunghezza, iter_min, iter_max, tolleranza, finestra):
    L = Q.shape[0]
    n_nuovo = nb - na
    prima = np.empty_like(Q)
    foto = Q.copy()          # posizioni di `finestra` iterazioni fa: la convergenza si misura su quel tratto
    carico = np.zeros(L)
    iterazioni = 0
    spost_max = 0.0
    while True:
        iterazioni += 1
        for i in range(L):
            prima[i, 0] = Q[i, 0]; prima[i, 1] = Q[i, 1]; prima[i, 2] = Q[i, 2]
        # flessione
        for q in range(flessi.shape[0]):
            i = flessi[q]
            for d in range(3):
                Q[i, d] += rigidezza * (0.5 * (Q[prec[i], d] + Q[succ[i], d]) - Q[i, d])
        # lunghezza: il filo in cucitura si tende verso la corda, gli altri hanno la loro lunghezza
        for _p in range(passi_lunghezza):
            for e in range(na, nb - 1):
                dx = Q[e + 1, 0] - Q[e, 0]; dy = Q[e + 1, 1] - Q[e, 1]; dz = Q[e + 1, 2] - Q[e, 2]
                lung = math.sqrt(dx * dx + dy * dy + dz * dz) * (1.0 - ritiro)
                minimo = corda / (n_nuovo - 1)
                riposo[e] = lung if lung > minimo else minimo
            for q in range(lati.shape[0]):
                i = lati[q]
                j = succ[i]
                ws = w[i] + w[j]
                if ws <= 0.0:
                    continue
                dx = Q[j, 0] - Q[i, 0]; dy = Q[j, 1] - Q[i, 1]; dz = Q[j, 2] - Q[i, 2]
                l = math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-12
                f = (l - riposo[i]) / l / ws
                Q[i, 0] += f * dx * w[i]; Q[i, 1] += f * dy * w[i]; Q[i, 2] += f * dz * w[i]
                Q[j, 0] -= f * dx * w[j]; Q[j, 1] -= f * dy * w[j]; Q[j, 2] -= f * dz * w[j]
        # carico lineare = tensione x angolo di curvatura / lunghezza del tratto
        for q in range(carico_idx.shape[0]):
            i = carico_idx[q]
            ax = Q[i, 0] - Q[prec[i], 0]; ay = Q[i, 1] - Q[prec[i], 1]; az = Q[i, 2] - Q[prec[i], 2]
            bx = Q[succ[i], 0] - Q[i, 0]; by = Q[succ[i], 1] - Q[i, 1]; bz = Q[succ[i], 2] - Q[i, 2]
            l1 = math.sqrt(ax * ax + ay * ay + az * az) + 1e-12
            l2 = math.sqrt(bx * bx + by * by + bz * bz) + 1e-12
            cosang = (ax * bx + ay * by + az * bz) / (l1 * l2)
            if cosang > 1.0:
                cosang = 1.0
            elif cosang < -1.0:
                cosang = -1.0
            carico[i] = T * math.acos(cosang) / (0.5 * (l1 + l2))
        # contatto comprimibile, sezione ellittica, attrito
        for q in range(ci.shape[0]):
            i = ci[q]; j = cj[q]
            dx = Q[j, 0] - Q[i, 0]; dy = Q[j, 1] - Q[i, 1]; dz = Q[j, 2] - Q[i, 2]
            l = math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-12
            if l >= r / Cl[i] + r / Cl[j]:
                continue
            nx = dx / l; ny = dy / l; nz = dz / l
            pen = _raggio(Q, i, prec, succ, nx, ny, nz, r, Cl[i]) + _raggio(Q, j, prec, succ, nx, ny, nz, r, Cl[j]) - l
            if pen <= 0.0:
                continue
            # compattazione plastica: il carico della coppia schiaccia entrambi i fili
            c_new = _compattazione(carico[i] if carico[i] > carico[j] else carico[j], c_min, carico_ref)
            if c_new < Cl[i]:
                Cl[i] = c_new
            if c_new < Cl[j]:
                Cl[j] = c_new
            if seg[i] != seg[j]:
                if seg[i] < seg[j]:
                    sov[i] = True
                else:
                    sov[j] = True
            ws = w[i] + w[j]
            if ws <= 0.0:
                continue
            # attrito: spostamento relativo tangenziale in questa iterazione
            rx = (Q[i, 0] - prima[i, 0]) - (Q[j, 0] - prima[j, 0])
            ry = (Q[i, 1] - prima[i, 1]) - (Q[j, 1] - prima[j, 1])
            rz = (Q[i, 2] - prima[i, 2]) - (Q[j, 2] - prima[j, 2])
            rn = rx * nx + ry * ny + rz * nz
            tx = rx - rn * nx; ty = ry - rn * ny; tz = rz - rn * nz
            lt = math.sqrt(tx * tx + ty * ty + tz * tz) + 1e-12
            if lt < mu_s * pen:
                fatt = 1.0
            else:
                fatt = mu_k * pen / lt
                if fatt > 1.0:
                    fatt = 1.0
            s = pen / ws
            Q[i, 0] += (-nx * s - tx * fatt / ws) * w[i]
            Q[i, 1] += (-ny * s - ty * fatt / ws) * w[i]
            Q[i, 2] += (-nz * s - tz * fatt / ws) * w[i]
            Q[j, 0] += (nx * s + tx * fatt / ws) * w[j]
            Q[j, 1] += (ny * s + ty * fatt / ws) * w[j]
            Q[j, 2] += (nz * s + tz * fatt / ws) * w[j]
        # appoggio sulla garza (anche lui schiaccia il filo, col carico del filo stesso)
        for q in range(flessi.shape[0]):
            i = flessi[q]
            pav = h_garza + r * Cl[i]
            if Q[i, 2] <= pav + 1e-9:
                c_new = _compattazione(carico[i], c_min, carico_ref)
                if c_new < Cl[i]:
                    Cl[i] = c_new
            pav = h_garza + r * Cl[i]
            if Q[i, 2] < pav:
                Q[i, 2] = pav
        # nodi infilzati: restano sull'asse del foro
        for q in range(legati.shape[0]):
            i = legati[q]
            Q[i, 0] = fori[i, 0]; Q[i, 1] = fori[i, 1]
        # fermo quando l'intorno non si muove più: spostamento medio per iterazione sulle ultime `finestra`
        # iterazioni (con finestra 1 è lo spostamento dell'ultima; più lunga, un avanti e indietro si annulla)
        if iterazioni % finestra != 0 and iterazioni < iter_max:
            continue
        spost_max = 0.0
        for q in range(flessi.shape[0]):
            i = flessi[q]
            for d in range(3):
                v = abs(Q[i, d] - foto[i, d]) / finestra
                if v > spost_max:
                    spost_max = v
        for i in range(L):
            foto[i, 0] = Q[i, 0]; foto[i, 1] = Q[i, 1]; foto[i, 2] = Q[i, 2]
        if iterazioni >= iter_min and (spost_max < tolleranza or iterazioni >= iter_max):
            break
    return iterazioni, spost_max


@njit(cache=True)
def _foro_comune(x, y, fa, px, py, fo, raggio_ago, stesso_foro):
    """Vero se il punto nuovo (x, y) e il nodo vecchio (px, py) stanno tutti e due dentro un foro che i loro
    punti condividono (fa: fori del punto nuovo, fo: del vecchio): lì i fili scendono insieme nel foro."""
    for h in range(2):
        hx = fa[2 * h]; hy = fa[2 * h + 1]
        if (x - hx) ** 2 + (y - hy) ** 2 >= raggio_ago * raggio_ago:
            continue
        for g in range(2):
            gx = fo[2 * g]; gy = fo[2 * g + 1]
            if (hx - gx) ** 2 + (hy - gy) ** 2 < stesso_foro * stesso_foro and                     (px - gx) ** 2 + (py - gy) ** 2 < raggio_ago * raggio_ago:
                return True
    return False


@njit(cache=True)
def _separazione(C, k, rho2, r, d2):
    """Distanza verticale minima fra il centro di un filo tondo che passa sopra e il nodo k (schiacciato:
    semiasse verticale r * C[k]), a distanza in pianta rho."""
    return (r + r * C[k]) * math.sqrt(1.0 - rho2 / d2)


@njit(cache=True)
def _sale_su(X, Y, ux, uy, fori_nuovo, P, seg_di, fori, dirs, k, rho2, coseno_paralleli, rp2, raggio_ago, stesso_foro):
    """Vero se un filo nuovo (direzione ux, uy) in X, Y deve passare sopra il nodo vecchio k invece di
    stargli di fianco o scendere con lui nel foro."""
    s = seg_di[k]
    if abs(dirs[s, 0] * ux + dirs[s, 1] * uy) > coseno_paralleli and rho2 >= rp2:
        return False
    return not _foro_comune(X, Y, fori_nuovo, P[k, 0], P[k, 1], fori[s], raggio_ago, stesso_foro)


@njit(cache=True)
def quota_fili(X, Y, ux, uy, fori_nuovo, P, C, seg_di, fori, dirs, succ, testa, origine, cella, limite,
               d, coseno_paralleli, raggio_paralleli, raggio_ago, stesso_foro):
    """Cucitura rigida, filo tondo: quota minima del centro di un filo di direzione (ux, uy) nei punti X, Y
    perché non compenetri i nodi già posati con indice < limite (-1e9 se non ne tocca nessuno).

    Un nodo vecchio a distanza in pianta rho < d impone z >= z_vecchio + (r + r * C) * sqrt(1 - rho²/d²)
    (C: quanto il nodo è rimasto alto dopo lo schiacciamento, 1 = tondo). Un filo quasi parallelo
    (|cos| > coseno_paralleli) ci sale solo se rho < raggio_paralleli, altrimenti gli sta di fianco; dentro
    un foro in comune i fili non si impilano (scendono insieme nel foro).
    Griglia: celle di lato `cella` >= d, liste concatenate testa/succ.
    """
    n = testa.shape[0]
    out = np.full(len(X), -1e9)
    d2 = d * d
    r = d / 2.0
    rp2 = raggio_paralleli * raggio_paralleli
    for q in range(len(X)):
        gx = int((X[q] - origine) / cella)
        gy = int((Y[q] - origine) / cella)
        for i in range(max(gx - 1, 0), min(gx + 2, n)):
            for j in range(max(gy - 1, 0), min(gy + 2, n)):
                k = testa[i, j]
                while k >= 0:
                    if k < limite:
                        dx = P[k, 0] - X[q]
                        dy = P[k, 1] - Y[q]
                        rho2 = dx * dx + dy * dy
                        if rho2 < d2 and _sale_su(X[q], Y[q], ux, uy, fori_nuovo, P, seg_di, fori, dirs, k, rho2,
                                                  coseno_paralleli, rp2, raggio_ago, stesso_foro):
                            h = P[k, 2] + _separazione(C, k, rho2, r, d2)
                            if h > out[q]:
                                out[q] = h
                    k = succ[k]
    return out


@njit(cache=True)
def inserisci_griglia(P, a, b, succ, testa, origine, cella):
    n = testa.shape[0]
    for k in range(a, b):
        i = min(max(int((P[k, 0] - origine) / cella), 0), n - 1)
        j = min(max(int((P[k, 1] - origine) / cella), 0), n - 1)
        succ[k] = testa[i, j]
        testa[i, j] = k


@njit(cache=True)
def _inviluppo(s, z, i0, i1, out):
    """Inviluppo convesso superiore dei punti i0..i1 (inclusi), interpolato in out[i0..i1]."""
    hull = np.empty(i1 - i0 + 1, np.int64)
    m = 0
    for i in range(i0, i1 + 1):
        while m >= 2:
            p0 = hull[m - 2]; p1 = hull[m - 1]
            if (s[p1] - s[p0]) * (z[i] - z[p0]) - (z[p1] - z[p0]) * (s[i] - s[p0]) >= 0:
                m -= 1
            else:
                break
        hull[m] = i
        m += 1
    for h in range(m - 1):
        p0 = hull[h]; p1 = hull[h + 1]
        for i in range(p0, p1 + 1):
            t = 0.0 if s[p1] <= s[p0] else (s[i] - s[p0]) / (s[p1] - s[p0])
            out[i] = z[p0] + t * (z[p1] - z[p0])


@njit(cache=True)
def curva(s, z, raggio):
    """Arrotonda gli spigoli del filo: il profilo non piega più stretto di `raggio` (rigidità del filo).
    Profilo percorso dal bordo alto di un cerchio di quel raggio fatto scorrere lungo il filo: resta sopra
    quello di partenza, uguale dove è dritto, e sopra ogni spigolo fa un arco. I capi restano dove sono."""
    n = len(s)
    out = z.copy()
    if raggio <= 0.0 or n < 3:
        return out
    r2 = raggio * raggio
    j0 = 0
    for i in range(1, n - 1):
        while s[i] - s[j0] >= raggio:
            j0 += 1
        j = j0
        while j < n and s[j] - s[i] < raggio:
            ds = s[j] - s[i]
            v = z[j] + math.sqrt(r2 - ds * ds) - raggio
            if v > out[i]:
                out[i] = v
            j += 1
    return out


@njit(cache=True)
def filo_teso(s, sotto, sopra):
    """Forma di un filo teso fra i capi (fissi: sotto[0] = sopra[0], sotto[-1] = sopra[-1]) che deve stare
    sopra `sotto` (gli appoggi) e sotto `sopra` (dove un filo che incrocia lo preme giù).

    Il filo più corto nel corridoio: l'inviluppo superiore degli appoggi; dove passa sopra un limite, il nodo
    più sforante viene fissato al limite e si rifà l'inviluppo nei due tratti. Fra due punti premuti il filo
    resta dritto, non torna su.
    """
    n = len(s)
    z = np.empty(n)
    fisso = np.zeros(n, np.bool_)
    fisso[0] = True
    fisso[n - 1] = True
    lb = sotto.copy()
    for _ in range(n):
        i0 = 0
        for i in range(1, n):
            if fisso[i]:
                _inviluppo(s, lb, i0, i, z)
                i0 = i
        peggio = -1
        sfora = 1e-9
        for i in range(n):
            if not fisso[i] and z[i] - sopra[i] > sfora:
                sfora = z[i] - sopra[i]
                peggio = i
        if peggio < 0:
            break
        fisso[peggio] = True
        lb[peggio] = sopra[peggio]
    return z


@njit(cache=True)
def tira_giu(x, y, z, ux, uy, fori_nuovo, P, C, seg_di, offs, fori, dirs, succ, testa, origine, cella, limite,
             d, coseno_paralleli, raggio_paralleli, raggio_ago, stesso_foro,
             tiro, schiacciamento, pila_max, h_garza, garza_foro, raggio_curva):
    """La bobina tira giù il filo nuovo: dove passa sopra un filo che incrocia lo preme verso la superficie
    e lo schiaccia un po'.

    Per ogni nodo vecchio toccato (sta sotto a meno della separazione), peso w = sqrt(1 - rho²/d²):
    - schiacciamento: C del nodo scende a 1 - schiacciamento * w * f;
    - tiro: il fondo del nodo scende verso il suo appoggio premuto di tiro * w * f della distanza.
    f = 1 - (fili sotto il nodo) / pila_max, fra 0 e 1: pieno se il filo sta sulla superficie, niente se sotto
    ha già una pila alta pila_max. Appoggio premuto = fili più vecchi sotto il nodo, o la garza compressa del
    tutto (h_garza * garza_foro); senza premere la garza resta intera. La garza cede a triangolo dai nodi
    premuti fino ai fori del punto. Il punto vecchio prende la forma di un filo teso (filo_teso) fra i suoi
    fori, sopra quegli appoggi e sotto i nodi premuti, con gli spigoli arrotondati (curva); non sale mai
    sopra dov'era. Il centro schiacciato sta a r * C sopra il fondo.
    Restituisce quanti punti vecchi sono stati toccati.
    """
    S = len(offs) - 1
    N = P.shape[0]
    toccato = np.zeros(S, np.bool_)
    peso = np.zeros(N)                  # w massimo per nodo vecchio toccato
    n = testa.shape[0]
    d2 = d * d
    r = d / 2.0
    rp2 = raggio_paralleli * raggio_paralleli
    for q in range(1, len(x) - 1):
        gx = int((x[q] - origine) / cella)
        gy = int((y[q] - origine) / cella)
        for i in range(max(gx - 1, 0), min(gx + 2, n)):
            for j in range(max(gy - 1, 0), min(gy + 2, n)):
                k = testa[i, j]
                while k >= 0:
                    if k < limite:
                        dx = P[k, 0] - x[q]
                        dy = P[k, 1] - y[q]
                        rho2 = dx * dx + dy * dy
                        if rho2 < d2 and _sale_su(x[q], y[q], ux, uy, fori_nuovo, P, seg_di, fori, dirs, k, rho2,
                                                  coseno_paralleli, rp2, raggio_ago, stesso_foro):
                            if z[q] - P[k, 2] <= _separazione(C, k, rho2, r, d2) + 1e-6:
                                w = math.sqrt(1.0 - rho2 / d2)
                                if w > peso[k]:
                                    peso[k] = w
                                toccato[seg_di[k]] = True
                    k = succ[k]
    quanti = 0
    X1 = np.zeros(1)
    Y1 = np.zeros(1)
    pav_garza = h_garza * garza_foro
    for sg in range(S):
        if not toccato[sg]:
            continue
        a = offs[sg]; b = offs[sg + 1]; m = b - a
        fs = fori[sg]
        s_ = np.zeros(m)
        for i in range(1, m):
            s_[i] = s_[i - 1] + math.sqrt((P[a + i, 0] - P[a + i - 1, 0]) ** 2 + (P[a + i, 1] - P[a + i - 1, 1]) ** 2)
        alto = np.empty(m)          # fondo più basso senza premere: fili sotto o garza intera
        basso = np.empty(m)         # fondo più basso premendo: fili sotto o garza compressa del tutto
        voluto = np.full(m, -1.0)   # fondo voluto nei nodi premuti (-1: non premuto)
        c_nuovo = np.empty(m)
        for i in range(m):
            k = a + i
            c_nuovo[i] = C[k]
            fondo = P[k, 2] - r * C[k]
            if i == 0 or i == m - 1:
                alto[i] = fondo; basso[i] = fondo
                continue
            X1[0] = P[k, 0]; Y1[0] = P[k, 1]
            fondo_fili = quota_fili(X1, Y1, dirs[sg, 0], dirs[sg, 1], fs, P, C, seg_di, fori, dirs, succ, testa,
                                    origine, cella, a, d, coseno_paralleli, raggio_paralleli, raggio_ago,
                                    stesso_foro)[0] - r
            dist = min(math.sqrt((P[k, 0] - fs[0]) ** 2 + (P[k, 1] - fs[1]) ** 2),
                       math.sqrt((P[k, 0] - fs[2]) ** 2 + (P[k, 1] - fs[3]) ** 2))
            rampa = min(max((dist - raggio_ago) / raggio_ago, 0.0), 1.0)
            superficie = h_garza * (garza_foro + (1.0 - garza_foro) * rampa)
            alto[i] = min(max(fondo_fili, superficie), fondo)        # un filo già più giù non risale
            basso[i] = min(max(fondo_fili, pav_garza), alto[i])
            f = min(max(1.0 - max(fondo_fili - superficie, 0.0) / pila_max, 0.0), 1.0)
            if peso[k] > 0.0 and f > 0.0:
                c_nuovo[i] = min(C[k], 1.0 - schiacciamento * peso[k] * f)
                voluto[i] = fondo - tiro * peso[k] * f * (fondo - basso[i])
        # la garza cede solo attorno a dove si preme: a triangolo da ogni nodo premuto fino ai fori del punto
        cede = np.zeros(m)
        for p_ in range(1, m - 1):
            if voluto[p_] < 0.0:
                continue
            for i in range(1, m - 1):
                t = i / p_ if i <= p_ else (m - 1 - i) / (m - 1 - p_)
                if t > cede[i]:
                    cede[i] = t
        if cede.max() <= 0.0:
            continue
        quanti += 1
        sotto = np.empty(m)
        sopra = np.empty(m)
        for i in range(m):
            k = a + i
            if i == 0 or i == m - 1:
                sotto[i] = P[k, 2]; sopra[i] = P[k, 2]
                continue
            sotto[i] = alto[i] - (alto[i] - basso[i]) * cede[i] + r * c_nuovo[i]
            sopra[i] = voluto[i] + r * c_nuovo[i] if voluto[i] >= 0.0 else 1e9
            if sotto[i] > sopra[i]:
                sotto[i] = sopra[i]
        zz = curva(s_, filo_teso(s_, sotto, sopra), raggio_curva)
        for i in range(1, m - 1):
            k = a + i
            if zz[i] < P[k, 2]:
                P[k, 2] = zz[i]
            C[k] = c_nuovo[i]
    return quanti


@njit(cache=True)
def contatto_ordinato(pos, ci, cj, n0, dc, s, inv_m, dp, cnt):
    """Rilassamento dopo la rimozione: contatto fra sezioni ellittiche che non cambia l'ordine sopra/sotto.

    Distanze misurate con x e y moltiplicati per s (rapporto fra semiasse verticale e orizzontale): la
    sezione diventa un cerchio di diametro dc. La normale n0 (in quello spazio) è fissata dallo stato di
    riposo, quindi un filo che a riposo stava sopra resta sopra anche se l'arco dell'altro sale. Correzioni
    mediate sul numero di contatti del nodo (Jacobi), come il resto del rilassamento.
    """
    for q in range(len(ci)):
        i = ci[q]; j = cj[q]
        vx = (pos[j, 0] - pos[i, 0]) * s[q]
        vy = (pos[j, 1] - pos[i, 1]) * s[q]
        vz = pos[j, 2] - pos[i, 2]
        proj = vx * n0[q, 0] + vy * n0[q, 1] + vz * n0[q, 2]
        pen = dc[q] - proj
        if pen <= 0.0:
            continue
        px = vx - proj * n0[q, 0]; py = vy - proj * n0[q, 1]; pz = vz - proj * n0[q, 2]
        if px * px + py * py + pz * pz >= dc[q] * dc[q]:
            continue                                   # di lato, fuori dalla sezione: non si toccano
        m = pen / 2.0
        ex = n0[q, 0] * m / s[q]; ey = n0[q, 1] * m / s[q]; ez = n0[q, 2] * m
        dp[i, 0] -= ex; dp[i, 1] -= ey; dp[i, 2] -= ez
        dp[j, 0] += ex; dp[j, 1] += ey; dp[j, 2] += ez
        cnt[i] += 1.0; cnt[j] += 1.0
