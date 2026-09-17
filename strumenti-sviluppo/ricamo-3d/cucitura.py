"""Cucitura incrementale: i fili già posati sono nodi fisici, non una mappa di altezze.

Per ogni punto, in ordine macchina:
  a) evento ago al foro (di partenza, se il punto viene da un salto, e di arrivo): cilindro verticale
     di diametro DIAMETRO_AGO; i nodi di filo esistenti dentro vengono spinti fuori radialmente, oppure,
     se l'ago li prende quasi al centro, infilzati e legati al foro;
  b) posa del nuovo filo teso tra i due fori, sopra garza e fili esistenti (inviluppo superiore);
     finché il punto è in cucitura il filo scorre nei fori tirato dal tendifilo: a ogni passata si accorcia
     verso la corda finché contatto e garza non lo reggono (corda tesa). Quanto sprofonda negli ostacoli lo
     decide la compattazione, col carico = tensione x angolo. Chiuso il punto, la sua lunghezza di riposo è
     quella tesa meno TENSIONE_CN / EA (rigidità assiale dal tex) e da lì resta bloccata;
  c) rilassamento locale entro RAGGIO_LOCALE dal punto: lunghezza, flessione, contatto comprimibile
     con sezione ellittica, attrito coulombiano statico e dinamico, appoggio sulla garza. Fuori dal
     raggio i fili restano fermi.
Unità: mm, cN. Tutti i parametri sono in parametri.py.
"""
import math
import numpy as np
from scipy.spatial import cKDTree
import parametri as P

MARGINE_COPPIE = 0.2     # mm in più sul raggio di ricerca delle coppie: la lista vale per tutte le iterazioni del punto
BORDO_PARTECIPI = 0.6    # mm oltre RAGGIO_LOCALE: nodi fermi che il nuovo intorno può comunque toccare
STESSO_FORO = 0.05       # mm: un capo di punto a questa distanza dal foro sta nello stesso foro
RITIRO_PER_PASSATA = 0.05  # quanto si accorcia al più il filo in cucitura a ogni passata: passo numerico, non
                           # fisico, piccolo abbastanza da non fargli attraversare un filo sottile


def compattazione(carico):
    """Compattazione (1 = sezione tonda) in funzione del carico lineare in cN/mm."""
    return P.COMPATTAZIONE_MIN + (1 - P.COMPATTAZIONE_MIN) * np.exp(-np.maximum(carico, 0.0) / P.CARICO_COMPATTAZIONE)


def _somma(idx, val, n):
    """Somma per indice di un vettore (m,3) su n nodi: np.add.at, ma con bincount (più veloce)."""
    out = np.empty((n, 3))
    for c in range(3):
        out[:, c] = np.bincount(idx, weights=val[:, c], minlength=n)
    return out


def assi_sezione(pos, prec, succ):
    """Per ogni nodo i due assi della sezione: laterale (orizzontale, perpendicolare al filo) e binormale."""
    tng = pos[succ] - pos[prec]
    tng /= np.linalg.norm(tng, axis=1)[:, None] + 1e-12
    lat = np.c_[-tng[:, 1], tng[:, 0], np.zeros(len(tng))]
    ll = np.linalg.norm(lat, axis=1)
    lat = np.where(ll[:, None] > 1e-6, lat / (ll[:, None] + 1e-12), np.array([1.0, 0.0, 0.0]))
    return lat, np.cross(tng, lat)


def raggio_sezione(i, lat, bin_, nrm, r, comp):
    """Distanza centro-superficie del filo nel nodo i, nella direzione nrm, letta nel piano della sezione.

    La sezione è un'ellisse ad area costante: semiasse orizzontale (perpendicolare al filo) r / c, verticale
    r * c. La componente di nrm lungo il filo non conta: due strati paralleli con i nodi sfalsati lungo il
    filo si toccano col semiasse stretto, non con la larghezza del nastro.
    """
    ns = np.einsum("ij,ij->i", nrm, lat[i])
    nb = np.einsum("ij,ij->i", nrm, bin_[i])
    nn = np.hypot(ns, nb) + 1e-12
    return np.sqrt((r / comp[i] * ns / nn) ** 2 + (r * comp[i] * nb / nn) ** 2)


def _distanza_da_segmento(xy, a, b):
    ab = b - a
    l2 = float(ab @ ab)
    t = np.clip(((xy - a) @ ab) / l2, 0.0, 1.0) if l2 > 0 else np.zeros(len(xy))
    return np.hypot(*(xy - (a + t[:, None] * ab)).T)


def cuci(segs, offs, seg_id, loc, nloc, r, h_garza, filato, involucro_superiore, progresso=None):
    F = P.FILATI[filato]
    materiale = F.get("materiale", "cotone")
    T = float(P.TENSIONE_CN)
    EA = P.MODULO_SPECIFICO_CN_TEX[materiale] * F["tex"]
    eps = T / EA
    mu_s = P.ATTRITO[materiale]
    mu_k = mu_s * P.ATTRITO_DINAMICO_FRAZ
    soglia = P.SOGLIA_INFILZATO[materiale] * r
    R_ago = P.DIAMETRO_AGO / 2
    d = 2 * r
    raggio_max = r / P.COMPATTAZIONE_MIN          # semiasse orizzontale massimo

    N = int(offs[-1])
    pos = np.zeros((N, 3))
    comp = np.ones(N)
    posato = np.zeros(N, bool)
    ancora = (loc == 0) | (loc == nloc - 1)
    riposo = np.zeros(N)                          # lunghezza di riposo del lato (i, i+1)
    corde = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    lungo_filo = np.minimum(loc, nloc - 1 - loc) * (corde[seg_id] / (nloc - 1))   # distanza dal foro più vicino
    vicino_foro = lungo_filo < 0.6 * d
    foro_a, foro_b = segs[seg_id, 0:2], segs[seg_id, 2:4]
    interno = ~ancora
    legato = np.zeros(N, bool)
    foro_legato = np.zeros((N, 2))
    sovrapposto = np.zeros(N, bool)
    pos_posa = np.zeros((N, 3))
    infilzati = 0

    def evento_ago(foro):
        nonlocal infilzati
        idx = np.where(posato & interno & ~legato)[0]
        if len(idx) == 0:
            return
        dxy = pos[idx, :2] - foro
        dist = np.hypot(dxy[:, 0], dxy[:, 1])
        a_sem = r / comp[idx]
        dentro = dist < R_ago + a_sem
        if not dentro.any():
            return
        idx, dxy, dist, a_sem = idx[dentro], dxy[dentro], dist[dentro], a_sem[dentro]
        # fili che hanno già un capo in questo foro ci passano dentro: l'ago non li sposta
        capo_qui = ((np.hypot(*(foro_a[idx] - foro).T) < STESSO_FORO) | (np.hypot(*(foro_b[idx] - foro).T) < STESSO_FORO))
        libero = ~(capo_qui & (lungo_filo[idx] < R_ago + r))
        idx, dxy, dist, a_sem = idx[libero], dxy[libero], dist[libero], a_sem[libero]
        spinto = dist > soglia
        if spinto.any():
            u = dxy[spinto] / dist[spinto, None]
            pos[idx[spinto], :2] = foro + u * (R_ago + a_sem[spinto])[:, None]
        preso = idx[~spinto]
        if len(preso):
            legato[preso] = True
            foro_legato[preso] = foro
            pos[preso, :2] = foro
            infilzati += len(np.unique(seg_id[preso]))

    iter_usate = np.zeros(len(segs), int)
    non_converso = 0
    g2l = np.full(N, -1, dtype=np.int64)          # da indice globale a indice nell'intorno del punto
    for k in range(len(segs)):
        a, b = int(offs[k]), int(offs[k + 1])
        n = b - a
        A, B = segs[k, 0:2], segs[k, 2:4]

        # --- a) ago ---------------------------------------------------------------
        if k == 0 or np.hypot(*(segs[k - 1, 2:4] - A)) > 1e-9:
            evento_ago(A)
        evento_ago(B)

        # distanza in pianta dal punto dei nodi già posati (dopo l'ago): decide chi entra nell'intorno
        vecchi_tutti = np.where(posato)[0]            # tutti prima di a: i punti si posano in ordine
        d_vecchi = _distanza_da_segmento(pos[vecchi_tutti, :2], A, B) if len(vecchi_tutti) else np.zeros(0)

        # --- b) posa del filo teso ------------------------------------------------
        t = np.linspace(0, 1, n)
        xy = A + (B - A) * t[:, None]
        prof = np.full(n, h_garza + r)
        vecchi = vecchi_tutti[d_vecchi <= raggio_max + r + 1e-9]
        if len(vecchi):
            albero = cKDTree(pos[vecchi, :2])
            coppie = albero.sparse_distance_matrix(cKDTree(xy), raggio_max + r, output_type="ndarray")
            if len(coppie):
                j = vecchi[coppie["i"]]
                # si sale su un filo solo se i centri si sovrappongono davvero (semiasse stretto): un vicino
                # allargato dallo schiacciamento lo sposta il contatto di lato, non lo scavalca la posa
                portata = r * comp[j] + r
                vicino = coppie["v"] < portata
                if vicino.any():
                    j, q, dq, portata = j[vicino], coppie["j"][vicino], coppie["v"][vicino], portata[vicino]
                    alto = pos[j, 2] + (r * comp[j] + r) * np.sqrt(1 - (dq / portata) ** 2)
                    np.maximum.at(prof, q, alto)
        prof[0] = prof[-1] = r
        z = involucro_superiore(t * corde[k], prof)
        pos[a:b] = np.c_[xy, z]
        posato[a:b] = True
        riposo[a:b - 1] = np.linalg.norm(np.diff(pos[a:b], axis=0), axis=1)

        # --- c) rilassamento locale -----------------------------------------------
        # Si lavora solo sull'intorno: partecipi (entro RAGGIO_LOCALE + BORDO_PARTECIPI) più i loro vicini
        # lungo il filo, che servono a tangenti e curvature. Il costo per punto dipende dall'intorno,
        # non dal numero di nodi del ritaglio.
        nuovi = np.arange(a, b)
        dentro_p = d_vecchi <= P.RAGGIO_LOCALE + BORDO_PARTECIPI
        part = np.concatenate([vecchi_tutti[dentro_p], nuovi])
        attivi_g = np.concatenate([vecchi_tutti[dentro_p][d_vecchi[dentro_p] <= P.RAGGIO_LOCALE], nuovi])
        prima_di = part[loc[part] > 0] - 1
        dopo_di = part[loc[part] < nloc[part] - 1] + 1
        ids = np.union1d(part, np.concatenate([prima_di, dopo_di]))
        L = len(ids)
        g2l[ids] = np.arange(L)
        io = np.arange(L)
        loc_l, nloc_l, seg_l = loc[ids], nloc[ids], seg_id[ids]
        interno_l = interno[ids]
        prec = g2l[np.maximum(ids - 1, 0)]
        succ = g2l[np.minimum(ids + 1, N - 1)]
        prec = np.where((loc_l > 0) & (prec >= 0), prec, io)
        succ = np.where((loc_l < nloc_l - 1) & (succ >= 0), succ, io)
        attivo_l = np.zeros(L, bool)
        attivo_l[g2l[attivi_g]] = True
        partecipe_l = np.zeros(L, bool)
        partecipe_l[g2l[part]] = True
        mobile_l = attivo_l & interno_l
        w = mobile_l.astype(float)
        ha_succ = (loc_l < nloc_l - 1) & (succ != io)
        lati_l = np.where(ha_succ & (attivo_l | attivo_l[succ]))[0]
        lati_s = succ[lati_l]
        flessi = np.where(mobile_l)[0]
        mob_legati = np.where(mobile_l & legato[ids])[0]
        fori_l = foro_legato[ids]
        vicino_foro_l = vicino_foro[ids]
        na, nb = int(g2l[a]), int(g2l[b - 1]) + 1     # il punto nuovo, contiguo in fondo all'intorno

        coppie = cKDTree(pos[part]).query_pairs(2 * raggio_max + MARGINE_COPPIE, output_type="ndarray")
        if len(coppie):
            ci, cj = g2l[part[coppie[:, 0]]], g2l[part[coppie[:, 1]]]
            tieni = ~((seg_l[ci] == seg_l[cj]) & (np.abs(loc_l[ci] - loc_l[cj]) <= 3))
            tieni &= ~vicino_foro_l[ci] & ~vicino_foro_l[cj]
            tieni &= (w[ci] + w[cj]) > 0
            ci, cj = ci[tieni], cj[tieni]
        else:
            ci = cj = np.zeros(0, int)
        # nodi dove si misura il carico: interni dei partecipi
        carico_idx = np.where(partecipe_l & interno_l)[0]

        Q = pos[ids].copy()
        Cl = comp[ids].copy()
        riposo_l = riposo[ids].copy()
        sov_l = np.zeros(L, bool)
        mobili = np.where(mobile_l)[0]
        iterazioni = 0
        while True:
            iterazioni += 1
            prima = Q.copy()
            # flessione
            if len(flessi):
                lap = (Q[prec[flessi]] + Q[succ[flessi]]) / 2 - Q[flessi]
                Q[flessi] += P.RIGIDEZZA_FLESSIONE * lap
            # lunghezza: il filo in cucitura si tende verso la corda, gli altri hanno la loro lunghezza
            for _p in range(P.PASSI_LUNGHEZZA):
                if not len(lati_l):
                    break
                lati_nuovi = np.linalg.norm(np.diff(Q[na:nb], axis=0), axis=1)
                riposo_l[na:nb - 1] = np.maximum(corde[k] / (n - 1), lati_nuovi * (1 - RITIRO_PER_PASSATA))
                v = Q[lati_s] - Q[lati_l]
                l = np.linalg.norm(v, axis=1) + 1e-12
                w0, w1 = w[lati_l], w[lati_s]
                ws = w0 + w1
                ok = ws > 0
                corr = np.zeros_like(v)
                corr[ok] = ((l[ok] - riposo_l[lati_l[ok]]) / l[ok] / ws[ok])[:, None] * v[ok]
                dp = _somma(lati_l, corr * w0[:, None], L) - _somma(lati_s, corr * w1[:, None], L)
                cnt = np.bincount(lati_l, minlength=L) + np.bincount(lati_s, minlength=L)
                Q += dp / np.maximum(cnt, 1)[:, None]
            # carico lineare = tensione x angolo di curvatura / lunghezza del tratto
            carico = np.zeros(L)
            if len(carico_idx):
                e1 = Q[carico_idx] - Q[prec[carico_idx]]
                e2 = Q[succ[carico_idx]] - Q[carico_idx]
                l1 = np.linalg.norm(e1, axis=1) + 1e-12
                l2 = np.linalg.norm(e2, axis=1) + 1e-12
                cosang = np.clip(np.einsum("ij,ij->i", e1, e2) / (l1 * l2), -1, 1)
                carico[carico_idx] = T * np.arccos(cosang) / (0.5 * (l1 + l2))
            # contatto comprimibile, sezione ellittica, attrito
            tocca = np.zeros(0, bool)
            if len(ci):
                v = Q[cj] - Q[ci]
                l = np.linalg.norm(v, axis=1) + 1e-12
                # il raggio della sezione non supera mai il semiasse largo r / c: le coppie più lontane
                # della somma dei due non si toccano e si scartano prima del calcolo dell'ellisse
                forse = l < r / Cl[ci] + r / Cl[cj]
                if forse.any():
                    fi, fj, fl = ci[forse], cj[forse], l[forse]
                    nrm = v[forse] / fl[:, None]
                    lat, bin_ = assi_sezione(Q, prec, succ)
                    pen = raggio_sezione(fi, lat, bin_, nrm, r, Cl) + raggio_sezione(fj, lat, bin_, nrm, r, Cl) - fl
                    tocca = pen > 0
                if tocca.any():
                    ti, tj, tn, tp = fi[tocca], fj[tocca], nrm[tocca], pen[tocca]
                    # compattazione plastica: il carico della coppia schiaccia entrambi i fili
                    c_new = compattazione(np.maximum(carico[ti], carico[tj]))
                    np.minimum.at(Cl, ti, c_new)
                    np.minimum.at(Cl, tj, c_new)
                    # i fili più vecchi toccati dal nuovo intorno sono "sovrapposti"
                    sov_l[np.where(seg_l[ti] < seg_l[tj], ti, tj)[seg_l[ti] != seg_l[tj]]] = True
                    wi, wj = w[ti], w[tj]
                    ws = wi + wj
                    dn = tn * (tp / ws)[:, None]
                    # attrito: spostamento relativo tangenziale in questa iterazione
                    rel = (Q[ti] - prima[ti]) - (Q[tj] - prima[tj])
                    rel_t = rel - np.einsum("ij,ij->i", rel, tn)[:, None] * tn
                    lt = np.linalg.norm(rel_t, axis=1) + 1e-12
                    fatt = np.where(lt < mu_s * tp, 1.0, np.minimum(mu_k * tp / lt, 1.0))
                    dt = rel_t * fatt[:, None]
                    corr_i = (-dn - dt / ws[:, None]) * wi[:, None]
                    corr_j = (dn + dt / ws[:, None]) * wj[:, None]
                    dp = _somma(ti, corr_i, L) + _somma(tj, corr_j, L)
                    cnt = np.bincount(ti, minlength=L) + np.bincount(tj, minlength=L)
                    Q += dp / np.maximum(cnt, 1)[:, None]
            # appoggio sulla garza (anche lui schiaccia il filo, col carico del filo stesso)
            pavimento = h_garza + r * Cl[flessi]
            sotto = Q[flessi, 2] <= pavimento + 1e-9
            if sotto.any():
                np.minimum.at(Cl, flessi[sotto], compattazione(carico[flessi[sotto]]))
            Q[flessi, 2] = np.maximum(Q[flessi, 2], h_garza + r * Cl[flessi])
            # nodi infilzati: restano sull'asse del foro
            if len(mob_legati):
                Q[mob_legati, :2] = fori_l[mob_legati]
            # fermo quando l'intorno non si muove più (almeno ITER_LOCALI, al più ITER_LOCALI_MAX)
            spost_max = float(np.abs(Q[mobili] - prima[mobili]).max()) if len(mobili) else 0.0
            if iterazioni >= P.ITER_LOCALI and (spost_max < P.TOLLERANZA_LOCALE_MM or iterazioni >= P.ITER_LOCALI_MAX):
                break
        iter_usate[k] = iterazioni
        non_converso += spost_max >= P.TOLLERANZA_LOCALE_MM

        pos[ids] = Q
        comp[ids] = Cl
        riposo[ids] = riposo_l
        sovrapposto[ids] |= sov_l
        g2l[ids] = -1
        pos_posa[a:b] = pos[a:b]
        # punto chiuso: lunghezza di riposo = quella tesa meno l'allungamento sotto tensione
        riposo[a:b - 1] = np.linalg.norm(np.diff(pos[a:b], axis=0), axis=1) * (1 - eps)
        if progresso is not None:
            progresso(k + 1, len(segs))        # può sollevare un'eccezione per annullare

    # spostamento laterale dei fili sovrapposti: rispetto a dove erano a fine posa, perpendicolare al punto
    L_cucita = np.array([np.linalg.norm(np.diff(pos[offs[k]:offs[k + 1]], axis=0), axis=1).sum() for k in range(len(segs))])
    misura = sovrapposto & interno
    if misura.any():
        dirs = (foro_b - foro_a)[misura]
        perp = np.c_[-dirs[:, 1], dirs[:, 0]] / (np.hypot(dirs[:, 0], dirs[:, 1])[:, None] + 1e-12)
        spost = float(np.mean(np.abs(np.einsum("ij,ij->i", (pos[misura] - pos_posa[misura])[:, :2], perp))))
    else:
        spost = None
    return {"pos": pos, "comp": comp, "L_cucita": L_cucita, "legato": legato, "foro_legato": foro_legato,
            "infilzati": int(infilzati), "spostamento_laterale_mm": spost, "nodi_sovrapposti": int(misura.sum()),
            "iterazioni": iter_usate, "punti_non_convergenti": int(non_converso)}
