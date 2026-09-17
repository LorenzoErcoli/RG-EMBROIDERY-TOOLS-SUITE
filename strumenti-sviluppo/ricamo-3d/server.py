"""Interfaccia locale di ricamo-3d: carichi un DST, scegli il ritaglio, simuli, guardi il risultato.

    python server.py [file.dst] [--porta 5313] [--senza-browser]

Con un file sulla riga di comando la pagina si apre con quel DST già caricato.

Ascolta solo su 127.0.0.1. La pagina è lo stesso visualizzatore di esegui.py (viewer_template.html),
aperto senza dati: in quel caso mostra la parte per caricare il file.

API (JSON):
  GET  /api/iniziale           -> il DST passato sulla riga di comando (come /api/leggi), o {}
  POST /api/leggi              corpo = byte del DST, intestazione X-Nome = nome file (URL-encoded)
                               -> id, nome, punti, aghi, riquadro, segmenti (Int16 in decimi, base64)
  POST /api/simula             {id, cx, cy, lato, cucitura}  -> {lavoro}; annulla la simulazione in corso
  POST /api/annulla            annulla la simulazione in corso
  GET  /api/lavoro/<lavoro>    -> {fatto, totale, punti_fatti, punti_totali, trascorsi_s, riga, errore, dati}
"""
import argparse
import base64
import json
import os
import tempfile
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

import numpy as np

import esegui as E
import modello as M

LATO_MIN, LATO_MAX = 6.0, 60.0
MAX_BYTE = 20 * 1024 * 1024
file_caricati = {}      # id -> {"nome", "segs5"}
lavori = {}             # id -> stato del lavoro
iniziale = None         # risposta di leggi_dst per il file passato sulla riga di comando
turno = threading.Lock()  # una simulazione alla volta: sono tutte a piena CPU
fermi_attivi = []         # stop delle simulazioni non ancora finite: una nuova le annulla


def leggi_dst(dati, nome):
    fd, percorso = tempfile.mkstemp(suffix=".dst")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(dati)
        segs5 = M.fori_da_dst(percorso, con_ago=True)
    finally:
        os.remove(percorso)
    if len(segs5) == 0:
        raise ValueError("nel file non ci sono punti di cucitura")
    id_ = uuid.uuid4().hex[:12]
    file_caricati[id_] = {"nome": nome, "segs5": segs5}
    xy = segs5[:, :4]
    decimi = np.round(xy * 10).astype(np.int16)
    return {
        "id": id_, "nome": nome, "punti": int(len(segs5)), "aghi": int(segs5[:, 4].max()),
        "riquadro": [float(xy[:, [0, 2]].min()), float(xy[:, [1, 3]].min()), float(xy[:, [0, 2]].max()), float(xy[:, [1, 3]].max())],
        "segmenti": base64.b64encode(decimi.tobytes()).decode(),
        "segmenti_aghi": base64.b64encode(segs5[:, 4].astype(np.uint8).tobytes()).decode(),
    }


def avvia_simulazione(richiesta):
    f = file_caricati.get(richiesta.get("id"))
    if f is None:
        raise ValueError("file non trovato: ricaricalo")
    cx, cy, lato = float(richiesta["cx"]), float(richiesta["cy"]), float(richiesta["lato"])
    cucitura = richiesta.get("cucitura", "incrementale")
    if cucitura not in ("incrementale", "rigida"):
        raise ValueError("cucitura: 'incrementale' o 'rigida'")
    if not LATO_MIN <= lato <= LATO_MAX:
        raise ValueError(f"il lato del ritaglio va da {LATO_MIN:g} a {LATO_MAX:g} mm")
    mezzo = lato / 2
    segs = M.ritaglio(f["segs5"], cx, cy, mezzo)
    if len(segs) == 0:
        raise ValueError("nessun punto interamente dentro il ritaglio: spostalo o allargalo")
    id_ = uuid.uuid4().hex[:12]
    n_var = len(E.VARIANTI)
    stato = {"fatto": 0, "totale": n_var, "punti_fatti": 0, "punti_totali": n_var * int(len(segs)),
             "trascorsi_s": None, "riga": "in attesa che si fermi la simulazione precedente", "errore": None, "dati": None}
    lavori[id_] = stato
    nome_cucitura = "cucitura incrementale" if cucitura == "incrementale" else "cucitura rigida"
    descrizione = (f"Ritaglio {lato:g} × {lato:g} mm di {f['nome']}, centrato in ({cx:.1f}, {cy:.1f}) mm, {nome_cucitura}. "
                   "Parametri fisici di partenza, non ancora calibrati.")
    stop = threading.Event()
    for vecchio in fermi_attivi:        # una simulazione nuova annulla quelle in corso o in attesa
        vecchio.set()
    fermi_attivi.clear()
    fermi_attivi.append(stop)
    avanzamento = {}
    totali = {}

    def avviso(riga):
        stato["riga"] = riga
        if "|" in riga:
            stato["fatto"] += 1

    def passo(variante, k, n):
        avanzamento[variante] = k
        stato["punti_fatti"] = sum(avanzamento.values())
        # n comprende le cuciture della variante (con la garza e a 0 strati: una sola se gli strati sono 0)
        totali[variante] = n
        stato["punti_totali"] = sum(totali.values()) + (n_var - len(totali)) * max(totali.values())

    def lavoro():
        with turno:
            if stop.is_set():
                stato["errore"] = "annullata: è partita un'altra simulazione"
                return
            inizio = time.time()
            stato["trascorsi_s"] = 0.0

            def orologio():
                while stato["dati"] is None and stato["errore"] is None:
                    stato["trascorsi_s"] = round(time.time() - inizio, 1)
                    time.sleep(0.5)
            threading.Thread(target=orologio, daemon=True).start()
            try:
                stato["riga"] = f"{len(segs)} punti nel ritaglio, simulazione in corso"
                stato["dati"] = E.simula_varianti(segs, mezzo, lato_copertura=max(mezzo - 1.5, 0.5),
                                                  descrizione=descrizione, avviso=avviso, cucitura=cucitura,
                                                  passo=passo, stop=stop)
            except E.Annullata:
                stato["errore"] = "annullata: è partita un'altra simulazione"
            except Exception as e:  # noqa: BLE001 — l'errore va mostrato nella pagina
                stato["errore"] = f"{type(e).__name__}: {e}"
            finally:
                if stop in fermi_attivi:
                    fermi_attivi.remove(stop)

    threading.Thread(target=lavoro, daemon=True).start()
    return {"lavoro": id_, "punti": int(len(segs))}


class Gestore(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def rispondi(self, codice, corpo, tipo="application/json; charset=utf-8"):
        dati = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode("utf-8")
        self.send_response(codice)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dati)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dati)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self.rispondi(200, E.html_visualizzatore(None).encode("utf-8"), "text/html; charset=utf-8")
        if self.path == "/favicon.ico":
            self.send_response(204); self.end_headers(); return
        if self.path == "/api/iniziale":
            return self.rispondi(200, iniziale or {})
        if self.path.startswith("/api/lavoro/"):
            stato = lavori.get(self.path.rsplit("/", 1)[1])
            if stato is None:
                return self.rispondi(404, {"errore": "lavoro sconosciuto"})
            risposta = dict(stato)
            if stato["dati"] is not None or stato["errore"] is not None:
                lavori.pop(self.path.rsplit("/", 1)[1], None)   # consegnato: non si tiene in memoria
            return self.rispondi(200, risposta)
        self.rispondi(404, {"errore": "non trovato"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BYTE:
            return self.rispondi(413, {"errore": "file troppo grande"})
        corpo = self.rfile.read(n)
        try:
            if self.path == "/api/leggi":
                nome = unquote(self.headers.get("X-Nome") or "disegno.dst")
                return self.rispondi(200, leggi_dst(corpo, nome))
            if self.path == "/api/simula":
                return self.rispondi(200, avvia_simulazione(json.loads(corpo)))
            if self.path == "/api/annulla":
                for stop in fermi_attivi:
                    stop.set()
                return self.rispondi(200, {"annullate": len(fermi_attivi)})
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            return self.rispondi(400, {"errore": str(e)})
        self.rispondi(404, {"errore": "non trovato"})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dst", nargs="?", help="DST da aprire già caricato")
    ap.add_argument("--porta", type=int, default=5313)
    ap.add_argument("--senza-browser", action="store_true", help="non aprire il browser")
    args = ap.parse_args()
    global iniziale
    if args.dst:
        percorso = Path(args.dst)
        iniziale = leggi_dst(percorso.read_bytes(), percorso.name)
        print(f"caricato {percorso.name}: {iniziale['punti']} punti", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.porta), Gestore)
    indirizzo = f"http://127.0.0.1:{args.porta}/"
    print(f"ricamo-3d: interfaccia su {indirizzo} (Ctrl+C per fermare)", flush=True)
    if not args.senza_browser:
        webbrowser.open(indirizzo)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
