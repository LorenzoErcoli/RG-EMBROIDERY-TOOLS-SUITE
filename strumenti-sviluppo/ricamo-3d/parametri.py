"""Parametri fisici del modello. Tutti in mm salvo dove indicato.

Valori marcati DA_MISURARE sono ipotesi di partenza: vanno sostituiti con
misure sui campioni di calibrazione (0 / 1 / 2 strati di termogarza).
"""

# --- Filati -----------------------------------------------------------------
# Titolo "a peso" (wt): N km pesano 1 kg -> tex = 1000 / N.
# ATTENZIONE: se Cieffe indica il cotone come Ne 30/2 o simile, il tex cambia.
FILATI = {
    "cotone_30": {"tex": 1000 / 30, "colore": "#e9e4d6", "materiale": "cotone"},
    "cotone_40": {"tex": 1000 / 40, "colore": "#e9e4d6", "materiale": "cotone"},
}
DENSITA_APPARENTE_COTONE = 0.90  # g/cm3 = fibra ~1.5 x compattezza ~0.6  DA_MISURARE
SCHIACCIAMENTO_FILO = 0.60        # spessore che un filo aggiunge sotto tensione / diametro  DA_MISURARE
ALLUNGAMENTO_RECUPERATO = 0.010  # frazione di lunghezza persa al rilascio della tensione  DA_MISURARE
                                 # (non entra più nella rimozione: varrebbe uguale nelle due cuciture, vedi sotto)

# --- Schiacciamento ai fori (cucitura rigida e rilassamento) ------------------------
# Entro RAGGIO_AGO dal foro l'ago e la tensione schiacciano di più: ogni filo aggiunge d * SCHIACCIAMENTO_FORO
# (non d * SCHIACCIAMENTO_FILO) e sotto resta solo GARZA_FORO della garza compressa. Fra RAGGIO_AGO e
# 2 * RAGGIO_AGO si passa linearmente ai valori normali. Distanza = in pianta, dal più vicino dei due fori del punto.
RAGGIO_AGO = 0.375               # mm
SCHIACCIAMENTO_FORO = 0.30       # DA_MISURARE
GARZA_FORO = 0.35                # frazione di garza compressa rimasta sotto l'ago  DA_MISURARE

# --- Termogarza -------------------------------------------------------------
SPESSORE_GARZA_STRATO = 0.25     # mm nominali per strato  DA_MISURARE (calibro sul rotolo)
COMPRESSIONE_GARZA = 0.60        # spessore sotto ago e tensione / nominale  DA_MISURARE (sezione campione)

# --- Rilassamento dopo la rimozione -----------------------------------------
APERTURA_MAX_GRADI = 40          # quanto l'eccesso di filo può andare di lato invece che in alto
APERTURA_ECCESSO_PIENO = 0.25    # eccesso relativo (filo in più / lunghezza a 0 strati) a cui l'apertura è piena  DA_MISURARE
RIGIDEZZA_FLESSIONE = 0.08       # 0 = filo morbidissimo, 1 = rigido
GRAVITA_PER_ITER = 0.0           # mm di spinta verso il tessuto per iterazione. Solo per test:
                                 # a questa scala la rigidità del filo domina sul peso (con 0.0015 il filo crollava ai fori)
ITERAZIONI = 160

# --- Fori: sostegno e rientro del filo ----------------------------------------
# Collare: attorno al foro la garza strappata e il filo compresso tengono il filo sollevato. Dentro il foro
# l'ago l'ha tolta: pavimento = r + COLLARE_FRAZ * h_garza * forma, con forma 0 entro RAGGIO_AGO, 1 a
# 2 * RAGGIO_AGO, poi a scendere fino a 0 a COLLARE_RAGGIO.
COLLARE_FRAZ = 0.6               # frazione dello spessore di garza compressa che resta sotto il filo al foro  DA_MISURARE
COLLARE_RAGGIO = 1.0             # mm in pianta oltre i quali il collare non sostiene più  DA_MISURARE
# Rimozione: lo stato di riposo è la cucitura a 0 strati (stessa logica, ventaglio compreso). Filo in eccesso
# di un punto = lunghezza cucita con la garza - lunghezza cucita a 0 strati; parte rientra nel foro (verso il
# rovescio / i punti vicini) e non fa arco: lunghezza obiettivo = lunghezza a 0 strati + eccesso * (1 - RIENTRO_FORO).
RIENTRO_FORO = 0.4               # frazione dell'eccesso che rientra nel foro  DA_MISURARE (il più importante)
PASSI_LUNGHEZZA = 4
PASSO_NODI_FRAZ_DIAMETRO = 0.5   # distanza tra nodi = frazione del diametro filo
SEME = 7

# --- Ventaglio (cucitura rigida) --------------------------------------------------
# I passaggi ripetuti sugli stessi fori non si impilano in verticale ("castelli"): si aprono a ventaglio.
# Per ogni punto si provano SCOSTAMENTI_N scostamenti laterali fra -max e +max, con forma sin(pi t) (nulli ai
# fori, massimi al centro), max = min(VENTAGLIO_MAX_MM, VENTAGLIO_FRAZ * corda). Costo di un candidato:
# altezza media d'appoggio nella parte centrale (escluso VENTAGLIO_BORDO_FRAZ vicino a ogni foro)
# + K_VENTAGLIO * (lunghezza in pianta - corda). Vince il costo minimo; a parità lo scostamento più piccolo.
# SCOSTAMENTI_N = 1: nessun ventaglio (la cucitura rigida di prima).
SCOSTAMENTI_N = 25
VENTAGLIO_MAX_MM = 0.8           # DA_MISURARE (macro con righello)
VENTAGLIO_FRAZ = 0.22            # DA_MISURARE
VENTAGLIO_BORDO_FRAZ = 0.10
K_VENTAGLIO = 2.5                # mm di altezza che valgono 1 mm di filo in più  DA_MISURARE (macro con righello)
# Fasci (metrica): punti con entrambi i capi entro TOLLERANZA_FORI_FASCIO mm da quelli di un altro (in
# qualunque verso) sono passaggi sugli stessi fori; un fascio conta se ne ha almeno FASCIO_MIN_PASSAGGI.
# Nei DST veri i fori ripetuti non coincidono al decimo: 0,25 mm è circa un diametro di filo.
TOLLERANZA_FORI_FASCIO = 0.25
FASCIO_MIN_PASSAGGI = 4

# --- Cucitura incrementale (cucitura.py) -----------------------------------------
# I fili già posati sono nodi fisici: ogni punto, in ordine macchina, fa entrare l'ago, posa il filo
# teso e rilassa solo l'intorno. La cucitura rigida (heightfield) resta con --cucitura rigida.
RAGGIO_LOCALE = 2.5              # mm attorno al nuovo punto in cui i fili esistenti si muovono
ITER_LOCALI = 25                 # iterazioni minime di rilassamento locale per punto
# Il rilassamento locale continua finché nessun nodo si muove più di TOLLERANZA_LOCALE_MM in un'iterazione
# (con 25 iterazioni fisse il raso fitto non arrivava all'equilibrio e il risultato dipendeva dal conteggio).
ITER_LOCALI_MAX = 400            # tetto: sulle zone di calibrazione resta entro ~10 % dell'equilibrio (misurato a 3000)
TOLLERANZA_LOCALE_MM = 0.001     # 1 µm
# Come si risolvono i vincoli del rilassamento locale: "gauss-seidel" (uno alla volta, compilato con numba,
# ~4 volte più veloce a parità di iterazioni) o "jacobi" (correzioni mediate, numpy: il risolutore di prima,
# che misura la convergenza sulla singola iterazione).
SOLUTORE = "gauss-seidel"
# Con Gauss-Seidel lo spostamento si misura come media sulle ultime FINESTRA_CONVERGENZA iterazioni: un avanti
# e indietro fra contatti (attrito) si annulla, una deriva vera no. Con 1 le zone di calibrazione non si fermavano.
FINESTRA_CONVERGENZA = 10
TENSIONE_CN = 90                 # tensione del filo in cucitura, cN  DA_MISURARE (tensiometro)
# Rigidità assiale EA = modulo specifico x tex (cN). Allungamento sotto tensione = TENSIONE_CN / EA:
# il filo in cucitura ha lunghezza di riposo più corta di quella posata di questa frazione.
# Cotone 270: a 90 cN il cotone 30 si allunga dell'1 %, come ALLUNGAMENTO_RECUPERATO.
MODULO_SPECIFICO_CN_TEX = {"cotone": 270.0, "poliestere_filamento": 600.0}   # DA_MISURARE
# Contatto comprimibile: la distanza di contatto scende da d (senza carico) a d * COMPATTAZIONE_MIN.
# Compattazione = COMPATTAZIONE_MIN + (1 - COMPATTAZIONE_MIN) * exp(-carico / CARICO_COMPATTAZIONE),
# carico = tensione x angolo di curvatura del filo per mm (cN/mm): si irrigidisce avvicinandosi al limite.
# Sezione ellittica ad area costante: semiasse verticale r * c, orizzontale r / c.
COMPATTAZIONE_MIN = 0.45         # DA_MISURARE
CARICO_COMPATTAZIONE = 100.0     # cN/mm a cui avviene il 63 % della compattazione possibile  DA_MISURARE
# Attrito filo-filo coulombiano (PBD): statico ATTRITO, dinamico ATTRITO * ATTRITO_DINAMICO_FRAZ.
ATTRITO = {"cotone": 0.5, "poliestere_filamento": 0.25}                      # DA_MISURARE
ATTRITO_DINAMICO_FRAZ = 0.8      # DA_MISURARE
# Ago: cilindro verticale al foro. Un nodo di filo esistente entro raggio_ago + r viene spinto fuori se
# il suo centro dista dall'asse più di SOGLIA_INFILZATO * r, altrimenti è infilzato e resta legato al foro.
DIAMETRO_AGO = 0.75              # mm
SOGLIA_INFILZATO = {"cotone": 0.6, "poliestere_filamento": 0.3}              # DA_MISURARE


def diametro_filo(tex, densita=DENSITA_APPARENTE_COTONE):
    """Diametro equivalente (mm) da tex e densità apparente."""
    import math
    area_mm2 = tex / (densita * 1000.0)
    return 2.0 * math.sqrt(area_mm2 / math.pi)
