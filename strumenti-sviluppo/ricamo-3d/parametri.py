"""Parametri fisici del modello. Tutti in mm salvo dove indicato.

Valori marcati DA_MISURARE sono ipotesi di partenza: vanno sostituiti con
misure sui campioni di calibrazione (0 / 1 / 2 strati di termogarza).
"""

# --- Filati -----------------------------------------------------------------
# Titolo "a peso" (wt): N km pesano 1 kg -> tex = 1000 / N.
# ATTENZIONE: se Cieffe indica il cotone come Ne 30/2 o simile, il tex cambia.
FILATI = {
    "cotone_30": {"tex": 1000 / 30, "colore": "#e9e4d6"},
    "cotone_40": {"tex": 1000 / 40, "colore": "#e9e4d6"},
}
DENSITA_APPARENTE_COTONE = 0.90  # g/cm3 = fibra ~1.5 x compattezza ~0.6  DA_MISURARE
SCHIACCIAMENTO_FILO = 0.60        # spessore che un filo aggiunge sotto tensione / diametro  DA_MISURARE
ALLUNGAMENTO_RECUPERATO = 0.010  # frazione di lunghezza persa al rilascio della tensione  DA_MISURARE

# --- Termogarza -------------------------------------------------------------
SPESSORE_GARZA_STRATO = 0.25     # mm nominali per strato  DA_MISURARE (calibro sul rotolo)
COMPRESSIONE_GARZA = 0.60        # spessore sotto ago e tensione / nominale  DA_MISURARE (sezione campione)

# --- Rilassamento dopo la rimozione -----------------------------------------
APERTURA_MAX_GRADI = 40          # quanto l'eccesso di filo può andare di lato invece che in alto
RIGIDEZZA_FLESSIONE = 0.08       # 0 = filo morbidissimo, 1 = rigido
GRAVITA_PER_ITER = 0.0           # mm di spinta verso il tessuto per iterazione. Solo per test:
                                 # a questa scala la rigidità del filo domina sul peso (con 0.0015 il filo crollava ai fori)
ITERAZIONI = 160

# --- Fori: sostegno e rientro del filo ----------------------------------------
# Collare: attorno al foro la garza strappata e il filo compresso tengono il filo sollevato.
# Pavimento di un nodo libero = r + COLLARE_FRAZ * h_garza * max(0, 1 - distanza_dal_foro / COLLARE_RAGGIO)
COLLARE_FRAZ = 0.6               # frazione dello spessore di garza compressa che resta sotto il filo al foro  DA_MISURARE
COLLARE_RAGGIO = 0.45            # mm in pianta oltre i quali il collare non sostiene più  DA_MISURARE
# Rientro: parte dell'eccesso di filo scivola nel foro (verso il rovescio / i punti vicini) e non fa arco.
# Lunghezza obiettivo = corda + max(0, L_obiettivo - corda) * (1 - RIENTRO_FORO)
RIENTRO_FORO = 0.4               # frazione dell'eccesso che rientra nel foro  DA_MISURARE (il più importante)
PASSI_LUNGHEZZA = 4
PASSO_NODI_FRAZ_DIAMETRO = 0.5   # distanza tra nodi = frazione del diametro filo
SEME = 7


def diametro_filo(tex, densita=DENSITA_APPARENTE_COTONE):
    """Diametro equivalente (mm) da tex e densità apparente."""
    import math
    area_mm2 = tex / (densita * 1000.0)
    return 2.0 * math.sqrt(area_mm2 / math.pi)
