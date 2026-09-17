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
