using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    [DataContract]
    internal sealed class RunningChiesti
    {
        [DataMember(Name = "linee")] public List<LineaDaCopiare> Linee { get; set; }
        /// <summary>false: le copie entrano coi punti del modello, senza ricalcolo (per vedere se Stilista sa rifarle). Di serie true.</summary>
        [DataMember(Name = "ricalcola")] public bool? Ricalcola { get; set; }
    }

    [DataContract]
    internal sealed class RiscritturaChiesta
    {
        [DataMember(Name = "oggetti")] public List<RiscritturaDiUnOggetto> Oggetti { get; set; }
    }

    [DataContract]
    internal sealed class RiscritturaDiUnOggetto
    {
        [DataMember(Name = "indice")] public int Indice { get; set; }
        /// <summary>Il tracciato nuovo in mm; assente = resta quello che ha.</summary>
        [DataMember(Name = "contorno_mm")] public List<double[]> ContornoMm { get; set; }
        /// <summary>I punti cuciti in mm, nell'ordine.</summary>
        [DataMember(Name = "punti_mm")] public List<double[]> PuntiMm { get; set; }
    }

    [DataContract]
    internal sealed class LineaDaCopiare
    {
        /// <summary>L'oggetto da copiare (indice nel documento): una catenella, un passaggio…</summary>
        [DataMember(Name = "modello")] public int Modello { get; set; }
        /// <summary>La copia entra subito dopo questo oggetto (indice nel documento al momento della richiesta); le linee con lo stesso «dopo» entrano in fila.</summary>
        [DataMember(Name = "dopo")] public int Dopo { get; set; }
        /// <summary>Il tracciato nuovo, in mm nel riferimento del documento.</summary>
        [DataMember(Name = "contorno_mm")] public List<double[]> ContornoMm { get; set; }
        [DataMember(Name = "nome")] public string Nome { get; set; }
    }

    /// <summary>
    /// Infittire una rete (2026-10-29, Lorenzo: «A, procedi pure con la copia»):
    ///
    ///   POST /apri-copia?file=nome.emg3  apre in una finestra nuova una copia che sta in %TEMP%\rg-stilista-link
    ///                                   (solo lì: è la cartella delle copie del plugin, mai i file di Lorenzo)
    ///   POST /running                   { linee: [{ modello, dopo, contorno_mm, nome }], ricalcola? } → ogni linea è
    ///                                   una COPIA di un running del documento (coi suoi parametri: imbastitura,
    ///                                   catenella psil…) sul tracciato nuovo, messa nella sequenza subito dopo «dopo»
    ///
    /// Vedi sapere/riferimenti/rete-a-moduli.md.
    /// </summary>
    public sealed partial class CodexTab
    {
        private static string CartellaCopie => Path.Combine(Path.GetTempPath(), "rg-stilista-link");

        /// <summary>
        /// POST /riscrivi-punti (2026-11-02): { oggetti: [{ indice, contorno_mm?, punti_mm }] }. Dà a un oggetto che c'è già
        /// i punti chiesti, SENZA ricalcolarlo: in Stilista 3.3 una base del file di riferimento ricalcolata cambia tutti i punti (815 → 623)
        /// e perde la pulizia a mano. Risponde coi punti subito e 1,5 s dopo: se Stilista ricalcola da sé si vede.
        /// </summary>
        private Risposta RiceviRiscriviPunti(Richiesta r)
        {
            RiscritturaChiesta chiesta;
            try { chiesta = Leggi<RiscritturaChiesta>(r); }
            catch (Exception ex) { return Errore("JSON non valido: " + ex.Message); }
            if (chiesta?.Oggetti == null || chiesta.Oggetti.Count == 0)
            {
                return Errore("servono gli oggetti");
            }
            var esiti = (List<object[]>)NelFiloDiStilista(() => Riscrivi(chiesta));
            System.Threading.Thread.Sleep(1500);
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            for (var i = 0; i < esiti.Count; i++)
            {
                var o = esiti[i][0];
                var dopo = o == null ? 0 : (int)NelFiloDiStilista(() => ContaPunti(o));
                if (i > 0) sb.Append(',');
                sb.Append("{\"indice\":").Append(esiti[i][1]).Append(",\"chiesti\":").Append(esiti[i][2])
                  .Append(",\"subito\":").Append(esiti[i][3]).Append(",\"dopo_1500_ms\":").Append(dopo)
                  .Append(",\"errore\":").Append(Json.Stringa((string)esiti[i][4])).Append('}');
            }
            TryRaiseObjectsRedrawNeeded((object)NelFiloDiStilista(() => GetReadableMemberValue(Ricamo(), "Objects")));
            return Risposta.Testo(sb.Append("]}").ToString());
        }

        private List<object[]> Riscrivi(RiscritturaChiesta chiesta)
        {
            var tutti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
            var esiti = new List<object[]>();
            foreach (var c in chiesta.Oggetti)
            {
                if (c.Indice < 0 || c.Indice >= tutti.Count || c.PuntiMm == null || c.PuntiMm.Count < 2)
                {
                    esiti.Add(new object[] { null, c.Indice, c.PuntiMm?.Count ?? 0, 0, "indice fuori dal documento o punti mancanti" });
                    continue;
                }
                var o = tutti[c.Indice];
                try
                {
                    Func<double[], Point> inUm = p => new Point((int)Math.Round(p[0] * 1000.0), (int)Math.Round(p[1] * 1000.0));
                    if (c.ContornoMm != null && c.ContornoMm.Count >= 2)
                    {
                        var percorso = GetReadableMemberValue(o, "SourcePath");
                        var tag = PuntiConTag(percorso).Select(p => p[2]).ToList();
                        var primo = tag.Count > 0 ? tag[0] : 0;
                        var ultimo = tag.Count > 0 ? tag[tag.Count - 1] : 0;
                        var mezzo = tag.Count > 2 ? tag.Skip(1).Take(tag.Count - 2).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key : primo;
                        var contorno = c.ContornoMm.Where(p => p != null && p.Length >= 2).Select(inUm).ToList();
                        percorso?.GetType().GetProperty("CopyOfPoints")?.SetValue(percorso,
                            contorno.Select((p, k) => new TAGGEDPOINT(p.X, p.Y, k == 0 ? primo : k == contorno.Count - 1 ? ultimo : mezzo)).ToArray(), null);
                    }
                    var punti = c.PuntiMm.Where(p => p != null && p.Length >= 2).Select(inUm).Select(p => new TAGGEDPOINT(p.X, p.Y, 0)).ToArray();
                    FindMethodInHierarchy(o.GetType(), "OldPoints2StitchPath", new[] { typeof(TAGGEDPOINT[]) })?.Invoke(o, new object[] { punti });
                    TrySetBoolMember(o, "NeedRestitching", false);
                    esiti.Add(new object[] { o, c.Indice, punti.Length, ContaPunti(o), null });
                }
                catch (Exception ex)
                {
                    esiti.Add(new object[] { o, c.Indice, c.PuntiMm.Count, 0, DescribeException(ex) });
                }
            }
            return esiti;
        }

        private Risposta RiceviApriCopia(Richiesta r)
        {
            var nome = r.Query.TryGetValue("file", out var f) ? Path.GetFileName(f ?? "") : "";
            if (!nome.EndsWith(".emg3", StringComparison.OrdinalIgnoreCase))
            {
                return Errore("serve ?file=nome.emg3, un file della cartella delle copie");
            }
            var file = Path.Combine(CartellaCopie, nome);
            if (!File.Exists(file))
            {
                return Errore("non c'è " + file, 404);
            }
            NelFiloDiStilista(() => { _stilista.LoadNewEmb(file); return null; });
            Annota("Aperta una copia: " + nome);
            return Risposta.Testo("{\"ok\":true,\"file\":" + Json.Stringa(file) + "}");
        }

        private Risposta RiceviRunning(Richiesta r)
        {
            RunningChiesti chiesti;
            try { chiesti = Leggi<RunningChiesti>(r); }
            catch (Exception ex) { return Errore("JSON non valido: " + ex.Message); }
            if (chiesti?.Linee == null || chiesti.Linee.Count == 0)
            {
                return Errore("servono le linee");
            }
            return (Risposta)NelFiloDiStilista(() => CreaRunning(chiesti));
        }

        private Risposta CreaRunning(RunningChiesti chiesti)
        {
            const string log = "RGLink.Running";
            var embroidery = Ricamo();
            var oggetti = GetReadableMemberValue(embroidery, "Objects");
            if (embroidery == null || oggetti == null)
            {
                return Errore("nessun documento aperto", 409);
            }
            var tutti = SnapshotObjects(oggetti);
            if (chiesti.Linee.Any(l => l.Modello < 0 || l.Modello >= tutti.Count || l.Dopo < 0 || l.Dopo >= tutti.Count))
            {
                return Errore("modello e dopo vanno da 0 a " + (tutti.Count - 1));
            }
            // tutto per riferimento, prima di inserire: gli indici cambiano a ogni inserimento
            var linee = chiesti.Linee.Select(l => new { l, modello = tutti[l.Modello], ancora = tutti[l.Dopo] }).ToList();
            // Ogni copia di un psil crea migliaia di tipi di punto, e ognuno si iscrive a questo evento statico: restano in memoria per sempre, circa 25 MB a copia,
            // e una rete intera non ci sta (sapere/codice/stilista-psil.md). Alla fine si rimette la lista di iscritti di prima
            var eventoTipi = typeof(Emg2_IO.EmgTypes.cBaseStichTypeRO).GetFields(System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic).FirstOrDefault(c => c.FieldType.Name.Contains("TransparencyChanged"));
            var iscrittiPrima = eventoTipi?.GetValue(null);
            var ultimoDopo = new Dictionary<object, object>(new PerRiferimento());
            var ricalcola = chiesti.Ricalcola ?? true;
            var primaDi = tutti.Count;
            var sb = new StringBuilder();
            int fatte = 0, punti = 0;
            var errori = new List<string>();
            for (var i = 0; i < linee.Count; i++)
            {
                var x = linee[i];
                var contorno = (x.l.ContornoMm ?? new List<double[]>()).Where(p => p != null && p.Length >= 2)
                    .Select(p => new Point((int)Math.Round(p[0] * 1000.0), (int)Math.Round(p[1] * 1000.0))).ToList();
                if (contorno.Count < 2)
                {
                    errori.Add((i + 1) + ": tracciato con meno di 2 punti");
                    continue;
                }
                try
                {
                    var copia = Clona(x.modello, embroidery);
                    if (copia == null)
                    {
                        errori.Add((i + 1) + ": copia del modello non riuscita");
                        continue;
                    }
                    var tag = PuntiConTag(GetReadableMemberValue(x.modello, "SourcePath")).Select(p => p[2]).ToList();
                    var tagPrimo = tag.Count > 0 ? tag[0] : 0;
                    var tagUltimo = tag.Count > 0 ? tag[tag.Count - 1] : 0;
                    var tagMezzo = tag.Count > 2 ? tag.Skip(1).Take(tag.Count - 2).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key : tagPrimo;
                    var percorso = GetReadableMemberValue(copia, "SourcePath");
                    var tagged = contorno.Select((p, k) => new TAGGEDPOINT(p.X, p.Y, k == 0 ? tagPrimo : k == contorno.Count - 1 ? tagUltimo : tagMezzo)).ToArray();
                    percorso?.GetType().GetProperty("CopyOfPoints")?.SetValue(percorso, tagged, null);
                    ImpostaDescrizione(copia, "RG infittita · " + (x.l.Nome ?? (i + 1).ToString()));

                    // dopo l'ancora, o dopo l'ultima copia già messa dopo quell'ancora
                    var dopoDi = ultimoDopo.TryGetValue(x.ancora, out var u) ? u : x.ancora;
                    var dove = SnapshotObjects(oggetti).FindIndex(o => ReferenceEquals(o, dopoDi));
                    var metti = FindMethodInHierarchy(oggetti.GetType(), "Insert", new[] { typeof(int), copia.GetType() });
                    if (metti == null || dove < 0)
                    {
                        errori.Add((i + 1) + ": Insert non trovato, o l'ancora non c'è più");
                        continue;
                    }
                    metti.Invoke(oggetti, new object[] { dove + 1, copia });
                    ultimoDopo[x.ancora] = copia;

                    var calcolo = "non ricalcolato";
                    if (ricalcola)
                    {
                        TrySetBoolMember(copia, "NeedRestitching", true);
                        calcolo = InvokeDesignObjectRecalc(copia, log);
                    }
                    var cuciti = ContaPunti(copia);
                    if (cuciti > 0) { fatte++; punti += cuciti; }
                    else errori.Add((i + 1) + ": 0 punti (" + calcolo + ")");
                    if (sb.Length > 0) sb.Append(',');
                    sb.Append("{\"linea\":").Append(i + 1).Append(",\"al_posto\":").Append(dove + 1)
                      .Append(",\"punti\":").Append(cuciti).Append(",\"calcolo\":").Append(Json.Stringa(calcolo)).Append('}');
                }
                catch (Exception ex)
                {
                    errori.Add((i + 1) + ": " + DescribeException(ex));
                }
            }
            eventoTipi?.SetValue(null, iscrittiPrima);
            GC.Collect();
            TryRaiseObjectsRedrawNeeded(oggetti);
            var riassunto = "Running copiati: " + fatte + " su " + linee.Count + ", " + punti + " punti";
            ProbeLog.Write(log + ": " + riassunto + (errori.Count > 0 ? " · errori: " + string.Join(" | ", errori) : ""));
            Annota(riassunto);
            return Risposta.Testo("{\"ok\":" + (fatte > 0 ? "true" : "false") + ",\"fatte\":" + fatte + ",\"chieste\":" + linee.Count +
                                  ",\"punti\":" + punti + ",\"oggetti_prima\":" + primaDi + ",\"oggetti_dopo\":" + SnapshotObjects(oggetti).Count +
                                  ",\"errori\":[" + string.Join(",", errori.Select(Json.Stringa)) + "],\"dettaglio\":[" + sb + "]}");
        }
    }
}
