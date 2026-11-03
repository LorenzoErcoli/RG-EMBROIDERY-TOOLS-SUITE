using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>I parametri interi da cambiare su un oggetto che c'è già: { "PIThreadDistance": 400, … }.</summary>
    [DataContract]
    internal sealed class ParametriChiesti
    {
        [DataMember(Name = "oggetti")] public List<ParametriDiUnOggetto> Oggetti { get; set; }
    }

    [DataContract]
    internal sealed class ParametriDiUnOggetto
    {
        [DataMember(Name = "indice")] public int Indice { get; set; }
        [DataMember(Name = "parametri")] public Dictionary<string, int> Parametri { get; set; }
    }

    [DataContract]
    internal sealed class AgoChiesto
    {
        [DataMember(Name = "oggetti")] public List<int> Oggetti { get; set; }
        /// <summary>Da 1, come in Stilista.</summary>
        [DataMember(Name = "ago")] public int Ago { get; set; }
    }

    [DataContract]
    internal sealed class OrdineChiesto
    {
        /// <summary>L'oggetto che si sposta…</summary>
        [DataMember(Name = "da")] public int Da { get; set; }
        /// <summary>…e il posto che prende nella sequenza (da 0).</summary>
        [DataMember(Name = "a")] public int A { get; set; }
    }

    /// <summary>
    /// Le strade per comandare oggetti che sono già nel documento (2026-10-29, Lorenzo: «cosa possiamo controllare
    /// da chat a Stilista»). Ognuna fa una cosa sola con un metodo di Stilista già visto altrove nel plugin o nel
    /// bridge, e risponde con prima e dopo, così la prova si legge dalla risposta:
    ///
    ///   POST /parametri      { oggetti: [{ indice, parametri: { PIThreadDistance: 400, … } }] } → copia scrivibile dei
    ///                        parametri, valori cambiati, rimessi nell'oggetto, ricalcolo (come il bridge alla creazione)
    ///   POST /ago            { oggetti: [i…], ago } → CambiaAgo + ChangeAgo (TryAssignNativeNeedle del bridge)
    ///   POST /cancella?oggetti=i,j  → Remove dalla collezione del documento
    ///   POST /ordine         { da, a } → Remove + Insert al posto nuovo
    ///   GET  /punti-cuciti?oggetti=i  → tutti i punti cuciti (DesignObject.Stitches()), [x, y, tag] in µm
    ///
    /// Gli indici sono quelli del documento (come ?oggetti=). Vedi sapere/codice/stilista-cosa-si-comanda.md.
    /// </summary>
    public sealed partial class CodexTab
    {
        private static T Leggi<T>(Richiesta r) where T : class
        {
            using (var m = new MemoryStream(r.Corpo))
            {
                return new DataContractJsonSerializer(typeof(T), new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true }).ReadObject(m) as T;
            }
        }

        private static Risposta Errore(string testo, int stato = 400)
        {
            return Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa(testo) + "}", stato: stato);
        }

        private List<object> TuttiGliOggetti()
        {
            return SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
        }

        /// <summary>I parametri di un oggetto come li legge il bridge (nome → valore).</summary>
        private static Dictionary<string, string> ParametriDi(object oggetto)
        {
            var item = new VerificationObject();
            EnrichEmgReadObject(item, oggetto);
            return new Dictionary<string, string>(item.Parameters ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase);
        }

        private Risposta RiceviParametri(Richiesta r)
        {
            ParametriChiesti chiesti;
            try { chiesti = Leggi<ParametriChiesti>(r); }
            catch (Exception ex) { return Errore("JSON non valido: " + ex.Message); }
            if (chiesti?.Oggetti == null || chiesti.Oggetti.Count == 0)
            {
                return Errore("servono gli oggetti coi loro parametri");
            }
            return (Risposta)NelFiloDiStilista(() =>
            {
                var tutti = TuttiGliOggetti();
                var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
                var primo = true;
                foreach (var chiesto in chiesti.Oggetti)
                {
                    if (!primo) sb.Append(',');
                    primo = false;
                    sb.Append("{\"indice\":").Append(chiesto.Indice);
                    if (chiesto.Indice < 0 || chiesto.Indice >= tutti.Count || chiesto.Parametri == null)
                    {
                        sb.Append(",\"errore\":\"indice fuori dal documento o niente parametri\"}");
                        continue;
                    }
                    var oggetto = tutti[chiesto.Indice];
                    var prima = ParametriDi(oggetto);
                    var puntiPrima = ContaPunti(oggetto);
                    string esito;
                    try
                    {
                        var piano = new TranslationPlan { ObjectType = "esistente" };
                        foreach (var p in chiesto.Parametri) piano.ManagedIntParameters[p.Key] = p.Value;
                        ApplyTranslationPlanToDesignObject(oggetto, piano, true);
                        esito = "ok";
                    }
                    catch (Exception ex)
                    {
                        esito = DescribeException(ex);
                    }
                    var dopo = ParametriDi(oggetto);
                    sb.Append(",\"esito\":").Append(Json.Stringa(esito))
                      .Append(",\"punti_prima\":").Append(puntiPrima).Append(",\"punti_dopo\":").Append(ContaPunti(oggetto))
                      .Append(",\"parametri\":{");
                    sb.Append(string.Join(",", chiesto.Parametri.Keys.Select(k =>
                        Json.Stringa(k) + ":{\"chiesto\":" + chiesto.Parametri[k] +
                        ",\"prima\":" + Json.Stringa(prima.TryGetValue(k, out var a) ? a : null) +
                        ",\"dopo\":" + Json.Stringa(dopo.TryGetValue(k, out var d) ? d : null) + "}")));
                    sb.Append("}}");
                }
                TryRaiseObjectsRedrawNeeded(GetReadableMemberValue(Ricamo(), "Objects"));
                Annota("Parametri cambiati su " + chiesti.Oggetti.Count + " oggetti");
                return Risposta.Testo(sb.Append("]}").ToString());
            });
        }

        private Risposta RiceviAgo(Richiesta r)
        {
            AgoChiesto chiesto;
            try { chiesto = Leggi<AgoChiesto>(r); }
            catch (Exception ex) { return Errore("JSON non valido: " + ex.Message); }
            if (chiesto?.Oggetti == null || chiesto.Oggetti.Count == 0 || chiesto.Ago < 1)
            {
                return Errore("servono gli oggetti e l'ago (da 1)");
            }
            return (Risposta)NelFiloDiStilista(() =>
            {
                var ricamo = Ricamo();
                var tutti = TuttiGliOggetti();
                var esiti = new List<string>();
                foreach (var i in chiesto.Oggetti)
                {
                    if (i < 0 || i >= tutti.Count)
                    {
                        esiti.Add("{\"indice\":" + i + ",\"errore\":\"fuori dal documento\"}");
                        continue;
                    }
                    var prima = ReadNativeNeedleOneBased(tutti[i]);
                    // il colore resta quello che l'ago ha già nella tavolozza: non si ricolora tutto l'ago
                    var fatto = TryAssignNativeNeedle(GetReadableMemberValue(ricamo, "ListaFilati"), tutti[i], chiesto.Ago, null, "RGLink.Ago");
                    esiti.Add("{\"indice\":" + i + ",\"riuscito\":" + (fatto ? "true" : "false") +
                              ",\"ago_prima\":" + (prima?.ToString() ?? "null") + ",\"ago_dopo\":" + (ReadNativeNeedleOneBased(tutti[i])?.ToString() ?? "null") +
                              ",\"colore\":" + Json.Stringa(ReadNativeThreadColor(tutti[i])) + "}");
                }
                TryRaiseObjectsRedrawNeeded(GetReadableMemberValue(ricamo, "Objects"));
                Annota("Ago " + chiesto.Ago + " a " + chiesto.Oggetti.Count + " oggetti");
                return Risposta.Testo("{\"ok\":true,\"oggetti\":[" + string.Join(",", esiti) + "]}");
            });
        }

        private Risposta RiceviCancella(Richiesta r)
        {
            if (!r.Query.TryGetValue("oggetti", out var testo) || string.IsNullOrWhiteSpace(testo))
            {
                return Errore("serve ?oggetti=i,j");
            }
            var indici = testo.Split(',').Select(s => int.TryParse(s.Trim(), out var n) ? n : -1).Distinct().ToList();
            return (Risposta)NelFiloDiStilista(() =>
            {
                var oggetti = GetReadableMemberValue(Ricamo(), "Objects");
                var tutti = SnapshotObjects(oggetti);
                if (indici.Any(i => i < 0 || i >= tutti.Count))
                {
                    return Errore("indici fuori dal documento (" + tutti.Count + " oggetti)");
                }
                var prima = tutti.Count;
                var tolti = 0;
                foreach (var o in indici.Select(i => tutti[i]).ToList()) // per riferimento: gli indici cambiano togliendo
                {
                    var togli = FindMethodInHierarchy(oggetti.GetType(), "Remove", new[] { o.GetType() });
                    if (togli == null) return Errore("Remove non trovato sulla collezione del documento", 500);
                    togli.Invoke(oggetti, new[] { o });
                    tolti++;
                }
                TryRaiseObjectsRedrawNeeded(oggetti);
                var dopo = SnapshotObjects(oggetti).Count;
                Annota("Cancellati " + tolti + " oggetti");
                return Risposta.Testo("{\"ok\":" + (dopo == prima - tolti ? "true" : "false") + ",\"prima\":" + prima + ",\"dopo\":" + dopo + "}");
            });
        }

        private Risposta RiceviOrdine(Richiesta r)
        {
            OrdineChiesto chiesto;
            try { chiesto = Leggi<OrdineChiesto>(r); }
            catch (Exception ex) { return Errore("JSON non valido: " + ex.Message); }
            if (chiesto == null) return Errore("servono da e a");
            return (Risposta)NelFiloDiStilista(() =>
            {
                var oggetti = GetReadableMemberValue(Ricamo(), "Objects");
                var tutti = SnapshotObjects(oggetti);
                if (chiesto.Da < 0 || chiesto.Da >= tutti.Count || chiesto.A < 0 || chiesto.A >= tutti.Count)
                {
                    return Errore("da e a vanno da 0 a " + (tutti.Count - 1));
                }
                var o = tutti[chiesto.Da];
                var togli = FindMethodInHierarchy(oggetti.GetType(), "Remove", new[] { o.GetType() });
                var metti = FindMethodInHierarchy(oggetti.GetType(), "Insert", new[] { typeof(int), o.GetType() });
                if (togli == null || metti == null) return Errore("Remove/Insert non trovati sulla collezione del documento", 500);
                togli.Invoke(oggetti, new[] { o });
                metti.Invoke(oggetti, new[] { chiesto.A, o });
                TryRaiseObjectsRedrawNeeded(oggetti);
                var dove = SnapshotObjects(oggetti).FindIndex(x => ReferenceEquals(x, o));
                Annota("Oggetto " + chiesto.Da + " spostato al posto " + dove);
                return Risposta.Testo("{\"ok\":" + (dove == chiesto.A ? "true" : "false") + ",\"ora_al_posto\":" + dove +
                                      ",\"oggetti\":" + SnapshotObjects(oggetti).Count + ",\"punti\":" + ContaPunti(o) + "}");
            });
        }

        private object PuntiCuciti()
        {
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var primo = true;
            foreach (var o in Selezionati())
            {
                if (!primo) sb.Append(',');
                primo = false;
                var punti = FindMethodInHierarchy(o.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(o, null) as TAGGEDPOINT[] ?? new TAGGEDPOINT[0];
                sb.Append("{\"ago\":").Append(ReadNativeNeedleOneBased(o)?.ToString() ?? "null")
                  .Append(",\"conta\":").Append(punti.Length).Append(",\"punti\":[")
                  .Append(string.Join(",", punti.Select(p => "[" + p.X + "," + p.Y + "," + p.Tag + "]"))).Append("]}");
            }
            return Risposta.Testo(sb.Append("]}").ToString());
        }
    }
}
