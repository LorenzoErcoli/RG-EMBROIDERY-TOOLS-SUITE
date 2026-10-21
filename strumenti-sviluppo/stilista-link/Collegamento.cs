using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Windows.Forms;
using GmiGUI.Interfaces;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// RG Stilista Link: la scheda dentro Stilista. Non calcola niente: apre un tool della suite
    /// sulla selezione e risponde alle sue richieste su 127.0.0.1. Tutto quello che tocca il
    /// documento passa dal filo dell'interfaccia di Stilista, come un clic dell'utente.
    ///
    ///   GET  /stato            documento aperto, oggetti, selezionati
    ///   GET  /selezione.svg    i contorni selezionati, in mm, un colore per oggetto (per gli import dei tool)
    ///   GET  /selezione.json   gli stessi oggetti come li legge il bridge (tipo, contorno, punti, parametri)
    ///   GET  /sonda            campi e proprietà degli oggetti selezionati (ricerca, sola lettura)
    ///   POST /dst?nome=…       un DST: Stilista lo apre in un documento nuovo
    ///   POST /oggetti          un programma stilista-bridge-batch-1: oggetti nativi nel documento aperto
    ///   POST /punti            il ricamo di un tool, al suo posto nel documento aperto, a punti fissi (Collegamento.Ritorno.cs)
    ///
    /// Stilista apre un PROCESSO PER DOCUMENTO (più un processo d'avvio e qualche riserva «/WAIT»,
    /// tutti col plugin caricato): il server parte solo nel processo che mostra una finestra, sulla
    /// prima porta libera da PrimaPorta in su. Il pulsante passa al tool la porta della sua finestra;
    /// senza, il tool interroga le porte e prende la finestra attivata per ultima (/stato).
    /// </summary>
    public sealed partial class CodexTab : UserControl, IS3Tab, IStilistaExtension
    {
        internal const int PrimaPorta = 5370; // fuori dalle porte dei server di sviluppo della suite (5270-5313)
        internal const int QuantePorte = 10;
        private const string IndirizzoSuite = "http://localhost:5270/?stilista={0}#/pattern-grammar";
        private const double MargineMm = 1.0;

        // uno per processo, anche se Stilista creasse più schede
        private static ServerLocale _server;
        private static int _porta;
        private static DateTime _attivaAlle = DateTime.MinValue;

        private readonly Label _stato;
        private readonly Label _ultima;
        private IStilista3 _stilista;

        /// <summary>Dove stava, in Stilista, lo 0,0 dell'ultimo SVG dato ai tool (mm): serve a rimettere a posto il ritorno.</summary>
        private double _origineX, _origineY;

        /// <summary>L'ago del primo oggetto dell'ultima selezione: il ricamo che torna va su quello.</summary>
        private int? _agoSelezione;

#pragma warning disable 67
        public event Action<IS3Tab> RequestActivation;
#pragma warning restore 67

        public CodexTab()
        {
            BackColor = Color.WhiteSmoke;
            var apri = new Button { Dock = DockStyle.Top, Height = 40, Text = "Lavora la selezione con RG Tools (Generatore pattern)" };
            apri.Click += (s, e) => ApriSuite();
            _stato = new Label { Dock = DockStyle.Top, Height = 40, TextAlign = ContentAlignment.MiddleLeft, Text = "RG Link: avvio…" };
            _ultima = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.TopLeft, Text = "" };
            Controls.Add(_ultima);
            Controls.Add(_stato);
            Controls.Add(apri);
        }

        public string getName() { return "RG_LINK"; }
        public new void Load(string[] args) { }
        public bool IsVisible() { return true; }
        public bool isEnabled() { return true; }
        public bool isModificaVisible() { return true; }
        Control IS3Tab.getPanelControl() { return this; }
        bool IS3Tab.Activate() { return true; }
        bool IS3Tab.Deactivate() { return true; }
        void IS3Tab.ReActivate() { }
        int IS3Tab.getPriority() { return 0; }
        void IS3Tab.EmbTabActivated() { }
        void IS3Tab.EmbTabDeactivated() { }

        public void Init(IStilista3 stilista)
        {
            _stilista = stilista;
            var finestra = stilista?.Form;
            if (finestra == null)
            {
                _stato.Text = "RG Link: nessuna finestra di Stilista";
                return;
            }
            finestra.Activated += (s, e) => _attivaAlle = DateTime.UtcNow;
            finestra.VisibleChanged += (s, e) => { if (finestra.Visible) AvviaServer(); };
            if (finestra.Visible)
            {
                AvviaServer();
            }
            else
            {
                _stato.Text = "RG Link: in attesa che la finestra si apra";
            }
        }

        private void AvviaServer()
        {
            if (_server == null)
            {
                for (var porta = PrimaPorta; porta < PrimaPorta + QuantePorte && _server == null; porta++)
                {
                    try
                    {
                        var server = new ServerLocale(porta, Gestisci);
                        server.Avvia();
                        _server = server;
                        _porta = porta;
                        _attivaAlle = DateTime.UtcNow;
                        ProbeLog.Write("RGLink: in ascolto su " + porta + " (processo " + Process.GetCurrentProcess().Id + ")");
                    }
                    catch (Exception ex)
                    {
                        ProbeLog.Write("RGLink: porta " + porta + " occupata: " + ex.Message);
                    }
                }
            }
            _stato.Text = _server != null
                ? "RG Link in ascolto su 127.0.0.1:" + _porta
                : "RG Link spento: porte " + PrimaPorta + "–" + (PrimaPorta + QuantePorte - 1) + " tutte occupate";
        }

        private void ApriSuite()
        {
            if (_server == null)
            {
                Annota("Il collegamento è spento: vedi la riga sopra");
                return;
            }
            try
            {
                Process.Start(new ProcessStartInfo(string.Format(IndirizzoSuite, _porta)) { UseShellExecute = true });
                Annota("Aperto il Generatore pattern sulla selezione");
            }
            catch (Exception ex)
            {
                Annota("Non riesco ad aprire il browser: " + ex.Message);
            }
        }

        private void Annota(string testo)
        {
            ProbeLog.Write("RGLink: " + testo);
            NelFiloDiStilista(() => { _ultima.Text = DateTime.Now.ToString("HH:mm:ss") + "  " + testo; return null; });
        }

        /// <summary>Le richieste arrivano su un filo del server: il documento si tocca solo dal filo dell'interfaccia.</summary>
        private object NelFiloDiStilista(Func<object> lavoro)
        {
            Control filo = _stilista?.Form ?? (Control)this;
            if (!filo.IsHandleCreated)
            {
                return lavoro();
            }
            return filo.InvokeRequired ? filo.Invoke(lavoro) : lavoro();
        }

        private Risposta Gestisci(Richiesta r)
        {
            var chiave = r.Metodo + " " + r.Percorso.ToLowerInvariant();
            var chiesti = r.Query.TryGetValue("oggetti", out var o) ? o : null;
            Func<Func<object>, Risposta> conScelta = lavoro => (Risposta)NelFiloDiStilista(() =>
            {
                _oggettiChiesti = chiesti;
                try { return lavoro(); }
                finally { _oggettiChiesti = null; }
            });
            switch (chiave)
            {
                case "GET /stato": return (Risposta)NelFiloDiStilista(Stato);
                case "GET /selezione.svg": return conScelta(SelezioneSvg);
                case "GET /selezione.json": return conScelta(SelezioneJson);
                case "GET /sonda": return conScelta(Sonda);
                case "GET /fori": return conScelta(Fori);
                case "POST /dst": return RiceviDst(r);
                case "POST /oggetti": return RiceviOggetti(r);
                case "POST /punti": return RiceviPunti(r);
                case "POST /salva-copia": return (Risposta)NelFiloDiStilista(SalvaCopia);
                default: return Risposta.Testo("{\"ok\":false,\"errore\":\"non so " + chiave.Replace("\"", "") + "\"}", stato: 404);
            }
        }

        // ---- il documento ----

        private object Box()
        {
            return (_stilista?.ActiveEmbroideryContainer as IEmbroideryContainer)?.Box;
        }

        private object Ricamo()
        {
            var box = Box();
            return box != null ? GetReadableMemberValue(box, "Embroidery") : null;
        }

        /// <summary>Per le prove senza mouse: ?oggetti=0,3 usa quegli oggetti del documento al posto della selezione.</summary>
        [ThreadStatic] private static string _oggettiChiesti;

        private List<object> Selezionati()
        {
            var lista = new List<object>();
            if (!string.IsNullOrEmpty(_oggettiChiesti))
            {
                var tutti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
                foreach (var parte in _oggettiChiesti.Split(','))
                {
                    if (int.TryParse(parte.Trim(), out var i) && i >= 0 && i < tutti.Count)
                    {
                        lista.Add(tutti[i]);
                    }
                }
                return lista;
            }
            var box = Box();
            if (box != null && GetReadableMemberValue(box, "SelectedDsgObj") is IEnumerable sel)
            {
                foreach (var o in sel)
                {
                    if (o != null)
                    {
                        lista.Add(o);
                    }
                }
            }
            return lista;
        }

        private object Stato()
        {
            var oggetti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
            var titolo = _stilista?.Form?.Text;
            var attiva = _attivaAlle == DateTime.MinValue ? 0 : (long)(_attivaAlle - new DateTime(1970, 1, 1)).TotalMilliseconds;
            return Risposta.Testo("{\"ok\":true,\"plugin\":\"rg-stilista-link-1\",\"porta\":" + _porta +
                ",\"processo\":" + Process.GetCurrentProcess().Id +
                ",\"attiva_alle\":" + attiva +
                ",\"documento\":" + Json.Stringa(titolo) +
                ",\"oggetti\":" + oggetti.Count +
                ",\"selezionati\":" + Selezionati().Count + "}");
        }

        /// <summary>I punti di un percorso Stilista in µm, con il tag di ogni punto se c'è.</summary>
        private static List<int[]> PuntiConTag(object percorso)
        {
            // di solito il percorso dà i suoi TAGGEDPOINT tutti insieme: veloce anche a 130.000 punti
            if (FindMethodInHierarchy(percorso?.GetType(), "GetTaggedPoints", Type.EmptyTypes)?.Invoke(percorso, null) is GMICommons.SharedTypes.TAGGEDPOINT[] diretti)
            {
                return diretti.Select(p => new[] { p.X, p.Y, p.Tag }).ToList();
            }
            // altrimenti punto per punto, per riflessione (lento: decine di µs a punto)
            var punti = new List<int[]>();
            var grezzi = FindCoordinatePointArray(percorso);
            if (grezzi == null)
            {
                return punti;
            }
            foreach (var p in grezzi)
            {
                if (!TryReadCoordinates(p, out var x, out var y))
                {
                    continue;
                }
                var tag = TryConvertToInt(GetReadableMemberValue(p, "Tag")) ?? TryConvertToInt(GetReadableMemberValue(p, "tag")) ?? 0;
                punti.Add(new[] { x, y, tag });
            }
            return punti;
        }

        /// <summary>
        /// Il colore dei fori nell'SVG: ogni foro è un tracciato a sé, con questo colore, e l'SVG lo dichiara
        /// (data-rg-stilista-fori) così il tool gli dà il ruolo «area vuota». Se un filo selezionato ha già
        /// questo colore se ne usa un altro.
        /// </summary>
        private static readonly string[] ColoriFori = { "#FF00FF", "#00FFFF", "#808080" };

        private object SelezioneSvg()
        {
            var selezionati = Selezionati();
            if (selezionati.Count == 0)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"in Stilista non è selezionato niente\"}", stato: 409);
            }
            // (colore, punti, chiuso, titolo, foro)
            var forme = new List<Tuple<string, List<int[]>, bool, string, bool>>();
            double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
            for (var i = 0; i < selezionati.Count; i++)
            {
                var o = selezionati[i];
                ReadEmgObjectType(o, out var tipo, out _);
                var colore = ReadNativeThreadColor(o) ?? "#000000";
                var fori = 0;
                foreach (var anello in Anelli(o))
                {
                    var punti = anello.Punti;
                    if (punti.Count < 2)
                    {
                        continue;
                    }
                    var primo = punti[0];
                    var ultimo = punti[punti.Count - 1];
                    var chiuso = anello.Foro || string.Equals(tipo, "Fill", StringComparison.OrdinalIgnoreCase) ||
                                 Math.Abs(primo[0] - ultimo[0]) + Math.Abs(primo[1] - ultimo[1]) < 500;
                    var titolo = (tipo ?? "?") + " " + (i + 1) + (anello.Foro ? ", foro " + (++fori) : "");
                    forme.Add(Tuple.Create(colore, punti, chiuso, titolo, anello.Foro));
                    if (anello.Foro)
                    {
                        continue; // un foro sta dentro il suo esterno: non allarga la selezione
                    }
                    foreach (var p in punti)
                    {
                        minX = Math.Min(minX, p[0] / 1000.0); maxX = Math.Max(maxX, p[0] / 1000.0);
                        minY = Math.Min(minY, p[1] / 1000.0); maxY = Math.Max(maxY, p[1] / 1000.0);
                    }
                }
            }
            if (forme.Count(f => !f.Item5) == 0)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"gli oggetti selezionati non hanno un contorno\"}", stato: 409);
            }
            var coloriFili = new HashSet<string>(forme.Where(f => !f.Item5).Select(f => f.Item1), StringComparer.OrdinalIgnoreCase);
            var coloreFori = ColoriFori.FirstOrDefault(c => !coloriFili.Contains(c)) ?? ColoriFori[0];
            var quantiFori = forme.Count(f => f.Item5);
            // lo 0,0 del tool è l'angolo della selezione meno un margine: il piano del Generatore parte da 0
            _agoSelezione = ReadNativeNeedleOneBased(selezionati[0]);
            _origineX = minX - MargineMm;
            _origineY = minY - MargineMm;
            var larghezza = maxX - minX + 2 * MargineMm;
            var altezza = maxY - minY + 2 * MargineMm;
            var svg = new StringBuilder();
            svg.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"").Append(Json.Numero(larghezza)).Append("mm\" height=\"")
               .Append(Json.Numero(altezza)).Append("mm\" viewBox=\"0 0 ").Append(Json.Numero(larghezza)).Append(' ').Append(Json.Numero(altezza))
               .Append("\" data-rg-stilista-origine=\"").Append(Json.Numero(_origineX)).Append(' ').Append(Json.Numero(_origineY))
               .Append("\" data-rg-stilista-ago=\"").Append(_agoSelezione?.ToString() ?? "")
               .Append("\" data-rg-stilista-fori=\"").Append(quantiFori > 0 ? coloreFori : "").Append("\">\n");
            svg.Append("<!-- da Stilista: ").Append(SicuroXml(_stilista?.Form?.Text)).Append(" · ").Append(selezionati.Count)
               .Append(" oggetti, ").Append(quantiFori).Append(" fori -->\n");
            foreach (var f in forme)
            {
                svg.Append("<path fill=\"none\" stroke=\"").Append(f.Item5 ? coloreFori : f.Item1).Append("\" stroke-width=\"0.2\" d=\"");
                for (var i = 0; i < f.Item2.Count; i++)
                {
                    svg.Append(i == 0 ? "M" : " L").Append(Json.Numero(f.Item2[i][0] / 1000.0 - _origineX)).Append(' ')
                       .Append(Json.Numero(f.Item2[i][1] / 1000.0 - _origineY));
                }
                svg.Append(f.Item3 ? " Z" : "").Append("\"><title>").Append(SicuroXml(f.Item4)).Append("</title></path>\n");
            }
            svg.Append("</svg>\n");
            Annota("Selezione data al tool: " + selezionati.Count + " oggetti, " + quantiFori + " fori, " + Json.Numero(larghezza) + " × " + Json.Numero(altezza) + " mm");
            return Risposta.Testo(svg.ToString(), "image/svg+xml; charset=utf-8");
        }
        private static string SicuroXml(string testo)
        {
            return (testo ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("--", "- -");
        }

        private object SelezioneJson()
        {
            var lista = new List<VerificationObject>();
            var selezionati = Selezionati();
            for (var i = 0; i < selezionati.Count; i++)
            {
                var o = selezionati[i];
                var item = new VerificationObject
                {
                    Index = i,
                    Needle = ReadNativeNeedleOneBased(o),
                    ThreadColor = ReadNativeThreadColor(o),
                    StitchCount = TryConvertToInt(GetReadableMemberValue(o, "GetTotalNumberOfStitches")).GetValueOrDefault(),
                };
                EnrichEmgReadObject(item, o);
                lista.Add(item);
            }
            using (var m = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(List<VerificationObject>)).WriteObject(m, lista);
                // e i tag dei punti del contorno, che il lettore del bridge non conserva
                var tag = string.Join(",", selezionati.Select(o =>
                    "[" + string.Join(",", PuntiConTag(GetReadableMemberValue(o, "SourcePath")).Select(p => p[2]).Distinct()) + "]"));
                return Risposta.Testo("{\"ok\":true,\"oggetti\":" + Encoding.UTF8.GetString(m.ToArray()) + ",\"tag_del_contorno\":[" + tag + "]}");
            }
        }

        /// <summary>
        /// Per la ricerca: tipo, campi (con un'anteprima del valore) e proprietà (solo nome e tipo, i getter
        /// possono fare cose) degli oggetti selezionati e dei loro percorsi. Non scrive niente.
        /// </summary>
        private object Sonda()
        {
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var selezionati = Selezionati();
            for (var i = 0; i < selezionati.Count; i++)
            {
                var o = selezionati[i];
                if (i > 0) sb.Append(',');
                sb.Append("{\"oggetto\":").Append(Descrivi(o));
                foreach (var nome in new[] { "SourcePath", "StitchingPath", "Reel" })
                {
                    sb.Append(",\"").Append(nome).Append("\":").Append(Descrivi(GetReadableMemberValue(o, nome)));
                }
                sb.Append('}');
            }
            sb.Append("]}");
            return Risposta.Testo(sb.ToString());
        }

        private static string Descrivi(object o)
        {
            if (o == null)
            {
                return "null";
            }
            const BindingFlags tutti = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly;
            var sb = new StringBuilder("{\"tipo\":").Append(Json.Stringa(o.GetType().FullName)).Append(",\"gerarchia\":[");
            var catena = new List<Type>();
            for (var t = o.GetType(); t != null && t != typeof(object); t = t.BaseType) catena.Add(t);
            sb.Append(string.Join(",", catena.Select(t => Json.Stringa(t.FullName))));
            sb.Append("],\"interfacce\":[").Append(string.Join(",", o.GetType().GetInterfaces().Select(t => Json.Stringa(t.FullName)))).Append("],\"campi\":[");
            var primo = true;
            foreach (var t in catena)
            {
                foreach (var f in t.GetFields(tutti))
                {
                    string anteprima;
                    try
                    {
                        var v = f.GetValue(o);
                        anteprima = v == null ? "null" : v is ICollection c ? v.GetType().Name + "[" + c.Count + "]" : Convert.ToString(v);
                    }
                    catch (Exception ex)
                    {
                        anteprima = "<" + ex.GetType().Name + ">";
                    }
                    if (anteprima != null && anteprima.Length > 120) anteprima = anteprima.Substring(0, 120) + "…";
                    if (!primo) sb.Append(',');
                    primo = false;
                    sb.Append("[").Append(Json.Stringa(t.Name)).Append(',').Append(Json.Stringa(f.Name)).Append(',')
                      .Append(Json.Stringa(f.FieldType.FullName)).Append(',').Append(Json.Stringa(anteprima)).Append(']');
                }
            }
            sb.Append("],\"proprieta\":[");
            primo = true;
            foreach (var t in catena)
            {
                foreach (var p in t.GetProperties(tutti))
                {
                    if (!primo) sb.Append(',');
                    primo = false;
                    sb.Append("[").Append(Json.Stringa(t.Name)).Append(',').Append(Json.Stringa(p.Name)).Append(',')
                      .Append(Json.Stringa(p.PropertyType.FullName)).Append(',').Append(p.CanWrite ? "true" : "false").Append(']');
                }
            }
            sb.Append("],\"metodi\":[");
            primo = true;
            foreach (var t in catena)
            {
                foreach (var m in t.GetMethods(tutti).Where(m => !m.IsSpecialName))
                {
                    if (!primo) sb.Append(',');
                    primo = false;
                    sb.Append(Json.Stringa(t.Name + " :: " + m));
                }
            }
            return sb.Append("]}").ToString();
        }

        /// <summary>
        /// Per le verifiche: una COPIA del documento com'è adesso in memoria, in %TEMP%\rg-stilista-link
        /// (il file aperto non si tocca), da rileggere col lettore offline del bridge.
        /// </summary>
        private object SalvaCopia()
        {
            var cartella = Path.Combine(Path.GetTempPath(), "rg-stilista-link");
            Directory.CreateDirectory(cartella);
            var file = Path.Combine(cartella, "copia-" + DateTime.Now.ToString("HHmmss") + ".emg3");
            var ok = TrySerializeNativeEmbroidery(Ricamo(), file, "RGLink.SalvaCopia");
            return Risposta.Testo("{\"ok\":" + (ok ? "true" : "false") + ",\"file\":" + Json.Stringa(file) + "}", stato: ok ? 200 : 500);
        }

        // ---- quello che torna dalla suite ----

        private Risposta RiceviDst(Richiesta r)
        {
            if (r.Corpo.Length < 512)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"DST vuoto o troppo corto\"}", stato: 400);
            }
            var nome = r.Query.TryGetValue("nome", out var n) && n.Length > 0 ? n : "rg-tools";
            nome = new string(nome.Select(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '-').ToArray());
            var cartella = Path.Combine(Path.GetTempPath(), "rg-stilista-link");
            Directory.CreateDirectory(cartella);
            var file = Path.Combine(cartella, nome + "-" + DateTime.Now.ToString("HHmmss") + ".dst");
            File.WriteAllBytes(file, r.Corpo);
            NelFiloDiStilista(() => { _stilista.LoadNewEmb(file); return null; });
            Annota("Ricevuto un DST (" + (r.Corpo.Length / 1024) + " kB): aperto in un documento nuovo");
            return Risposta.Testo("{\"ok\":true,\"file\":" + Json.Stringa(file) +
                ",\"origine_mm\":[" + Json.Numero(_origineX) + "," + Json.Numero(_origineY) + "]}");
        }

        private Risposta RiceviOggetti(Richiesta r)
        {
            JsonBatchSpec batch;
            using (var m = new MemoryStream(r.Corpo))
            {
                batch = new DataContractJsonSerializer(typeof(JsonBatchSpec)).ReadObject(m) as JsonBatchSpec;
            }
            if (batch?.Objects == null || batch.Objects.Count == 0 || !string.Equals(batch.Type, "batch", StringComparison.OrdinalIgnoreCase))
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"serve un programma stilista-bridge-batch-1 con almeno un oggetto\"}", stato: 400);
            }
            var esito = (bool)NelFiloDiStilista(() =>
            {
                var ricamo = Ricamo();
                var oggetti = GetReadableMemberValue(ricamo, "Objects");
                return ricamo != null && oggetti != null && TryCreateRecalculableBatch(ricamo, oggetti, batch, null);
            });
            Annota(esito ? "Creati " + batch.Objects.Count + " oggetti nativi nel documento" : "Creazione oggetti fallita: vedi il log");
            return Risposta.Testo("{\"ok\":" + (esito ? "true" : "false") + ",\"oggetti\":" + batch.Objects.Count +
                ",\"log\":" + Json.Stringa(ProbeLog.PathOnDisk) + "}", stato: esito ? 200 : 500);
        }
    }
}
