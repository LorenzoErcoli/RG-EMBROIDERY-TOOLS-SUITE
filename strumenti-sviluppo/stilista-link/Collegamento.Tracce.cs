using System;
using System.Runtime.CompilerServices;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// L'interruttore delle tracce (Tracce.cs) dentro al plugin: le sue strade, «Pulisci documento» e la memoria della
    /// sentinella.
    ///
    /// LE STRADE le serve ServerLocale prima dell'elenco di Collegamento.cs (2026-11-12: quel file lo stava cambiando un
    /// altro lavoro): GET /tracce, POST /tracce?accese=1|0, POST /pulisci.
    ///
    /// LA SENTINELLA riconosceva i suoi oggetti dalla descrizione «RG Tools · ». Con le tracce spente la descrizione è
    /// vuota: li ricorda qui, finché la finestra resta aperta. Chiuso e riaperto il documento, un oggetto senza nome
    /// non lo protegge più nessuno (sapere/codice/stilista-tracce-rg.md: cosa si perde).
    /// </summary>
    public sealed partial class CodexTab
    {
        private static readonly ConditionalWeakTable<object, object> _nostri = new ConditionalWeakTable<object, object>();

        internal static void RicordaNostro(object oggetto)
        {
            if (oggetto != null && !_nostri.TryGetValue(oggetto, out _))
            {
                _nostri.Add(oggetto, true);
            }
        }

        /// <summary>Un oggetto a punti manuali tornato da un tool: dal nome, o perché l'ha messo questa finestra.</summary>
        private static bool ENostro(object oggetto, string descrizione)
        {
            return (descrizione != null && descrizione.StartsWith(PrefissoDescrizione, StringComparison.Ordinal)) ||
                   _nostri.TryGetValue(oggetto, out _);
        }

        internal static Risposta StradaDelleTracce(Richiesta r)
        {
            switch (r.Metodo + " " + r.Percorso.ToLowerInvariant())
            {
                case "GET /tracce":
                    return StatoTracce();
                case "POST /tracce":
                    var accese = r.Query.TryGetValue("accese", out var v) && v == "1";
                    Tracce.Imposta(accese);
                    ProbeLog.Write("RGLink.Tracce: " + (accese ? "accese" : "spente"));
                    return StatoTracce();
                case "POST /pulisci":
                    var io = _sentinellaDi;
                    return io == null
                        ? Risposta.Testo("{\"ok\":false,\"errore\":\"nessun documento in questa finestra\"}", stato: 503)
                        : (Risposta)io.NelFiloDiStilista(io.PulisciDocumento);
                default:
                    return null;
            }
        }

        private static Risposta StatoTracce()
        {
            return Risposta.Testo("{\"ok\":true,\"accese\":" + (Tracce.Accese ? "true" : "false") +
                ",\"di_serie\":" + (Tracce.Scelte ? "false" : "true") + "}");
        }

        /// <summary>
        /// POST /pulisci: toglie dal documento aperto i nomi «RG …» e i parametri che il plugin ha scritto (Lorenzo,
        /// 2026-11-12: gli EMG salvati dal 20 ottobre li hanno già). Le descrizioni restano vuote; i ricami non
        /// cambiano. Gli oggetti a punti manuali restano protetti dalla sentinella finché la finestra è aperta.
        /// </summary>
        private object PulisciDocumento()
        {
            var oggetti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
            var puliti = 0;
            foreach (var oggetto in oggetti)
            {
                var descrizione = Convert.ToString(GetReadableMemberValue(oggetto, "Description"));
                if (!Tracce.ENostra(descrizione))
                {
                    continue;
                }
                if (descrizione.StartsWith(PrefissoDescrizione, StringComparison.Ordinal))
                {
                    RicordaNostro(oggetto);
                }
                ScriviDescrizione(oggetto, "");
                puliti++;
            }
            ProbeLog.Write("RGLink.Tracce: puliti " + puliti + " oggetti su " + oggetti.Count);
            Annota("Tolti nomi e parametri RG da " + puliti + " oggetti: ora salva il documento. Le copie .Bak di Stilista hanno ancora la versione di prima");
            return Risposta.Testo("{\"ok\":true,\"puliti\":" + puliti + ",\"oggetti\":" + oggetti.Count + "}");
        }
    }
}
