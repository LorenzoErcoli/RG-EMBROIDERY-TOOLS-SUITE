using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>Ingresso e uscita da dare a un oggetto: in mm, nel riferimento del documento (o dell'SVG, con origine_mm).</summary>
    [DataContract]
    internal sealed class IngressoUscitaChiesti
    {
        /// <summary>Dove stava, in Stilista, lo 0,0 dell'SVG (data-rg-stilista-origine), in mm; assente = 0,0 del documento.</summary>
        [DataMember(Name = "origine_mm")] public double[] OrigineMm { get; set; }
        [DataMember(Name = "oggetti")] public List<IngressoUscitaDiUnOggetto> Oggetti { get; set; }
        /// <summary>"ui" (di serie): come lo sposta l'utente (setPointFromUI); "diretto": setPoint.</summary>
        [DataMember(Name = "modo")] public string Modo { get; set; }
    }

    [DataContract]
    internal sealed class IngressoUscitaDiUnOggetto
    {
        /// <summary>L'indice dell'oggetto nel documento; assente = l'oggetto selezionato con la stessa posizione nella lista.</summary>
        [DataMember(Name = "indice")] public int? Indice { get; set; }
        [DataMember(Name = "inizio_mm")] public double[] InizioMm { get; set; }
        [DataMember(Name = "fine_mm")] public double[] FineMm { get; set; }
    }

    /// <summary>
    /// INGRESSO E USCITA DI UN RIEMPIMENTO (2026-10-29, per Pattern a macchie: il raso fatto da Stilista, con
    /// ingresso, uscita e ordine decisi dal tool). Stilista li tiene in BaseObject.EnterExitMarkers (il campo
    /// myIniEndPoint, tipo MarkersPoints): PuntoInizio e PuntoFine sono quelli scelti dall'utente (int.MaxValue
    /// = non scelto, decide Stilista), PuntoIngresso e PuntoUscita le loro icone. Misurato spostandoli a mano:
    /// vedi sapere/codice/stilista-ingresso-uscita.md.
    ///
    ///   GET  /ingresso-uscita[?oggetti=…]   per ogni oggetto: inizio e fine scelti, primo e ultimo punto cucito
    ///   POST /ingresso-uscita               li scrive, ricalcola l'oggetto e li rilegge (subito e dopo 1,5 s)
    /// </summary>
    public sealed partial class CodexTab
    {
        private const int NonScelto = int.MaxValue;

        private object LeggiIngressoUscita()
        {
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var tutti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
            var primo = true;
            foreach (var oggetto in Selezionati())
            {
                if (!primo) sb.Append(',');
                primo = false;
                sb.Append(DescriviIngressoUscita(oggetto, tutti.IndexOf(oggetto), null, null));
            }
            return Risposta.Testo(sb.Append("]}").ToString());
        }

        private Risposta RiceviIngressoUscita(Richiesta r)
        {
            IngressoUscitaChiesti chiesti;
            try
            {
                using (var m = new MemoryStream(r.Corpo))
                {
                    chiesti = new DataContractJsonSerializer(typeof(IngressoUscitaChiesti)).ReadObject(m) as IngressoUscitaChiesti;
                }
            }
            catch (Exception ex)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa("JSON non valido: " + ex.Message) + "}", stato: 400);
            }
            if (chiesti?.Oggetti == null || chiesti.Oggetti.Count == 0)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"servono gli oggetti, ognuno con inizio_mm e/o fine_mm\"}", stato: 400);
            }
            var ox = chiesti.OrigineMm != null && chiesti.OrigineMm.Length >= 2 ? chiesti.OrigineMm[0] : 0;
            var oy = chiesti.OrigineMm != null && chiesti.OrigineMm.Length >= 2 ? chiesti.OrigineMm[1] : 0;
            Func<double[], Point?> inUm = p => p != null && p.Length >= 2
                ? new Point((int)Math.Round((p[0] + ox) * 1000.0), (int)Math.Round((p[1] + oy) * 1000.0))
                : (Point?)null;
            var dalUi = !string.Equals(chiesti.Modo, "diretto", StringComparison.OrdinalIgnoreCase);
            var chiesto = r.Query.TryGetValue("oggetti", out var q) ? q : null;

            // 1. scriverli, sul filo dell'interfaccia
            var lavori = (List<Tuple<object, int, Point?, Point?, string>>)NelFiloDiStilista(() =>
            {
                _oggettiChiesti = chiesto;
                try
                {
                    var tutti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
                    var selezionati = Selezionati();
                    var fatti = new List<Tuple<object, int, Point?, Point?, string>>();
                    for (var i = 0; i < chiesti.Oggetti.Count; i++)
                    {
                        var c = chiesti.Oggetti[i];
                        var oggetto = c.Indice.HasValue
                            ? (c.Indice.Value >= 0 && c.Indice.Value < tutti.Count ? tutti[c.Indice.Value] : null)
                            : (i < selezionati.Count ? selezionati[i] : null);
                        if (oggetto == null)
                        {
                            fatti.Add(Tuple.Create<object, int, Point?, Point?, string>(null, c.Indice ?? -1, null, null, "oggetto non trovato"));
                            continue;
                        }
                        var inizio = inUm(c.InizioMm);
                        var fine = inUm(c.FineMm);
                        var esito = ScriviIngressoUscita(oggetto, inizio, fine, dalUi);
                        TrySetBoolMember(oggetto, "NeedRestitching", true);
                        esito += " · ricalcolo: " + InvokeDesignObjectRecalc(oggetto, "RGLink.IngressoUscita");
                        fatti.Add(Tuple.Create(oggetto, tutti.IndexOf(oggetto), inizio, fine, esito));
                    }
                    TryRaiseObjectsRedrawNeeded(GetReadableMemberValue(Ricamo(), "Objects"));
                    return fatti;
                }
                finally
                {
                    _oggettiChiesti = null;
                }
            });

            // 2. rileggerli subito e dopo 1,5 s: Stilista può ricalcolare l'oggetto da sé, dopo
            Func<string> misura = () => (string)NelFiloDiStilista(() => string.Join(",", lavori.Select(l =>
                l.Item1 == null ? "{\"indice\":" + l.Item2 + ",\"errore\":" + Json.Stringa(l.Item5) + "}"
                                : DescriviIngressoUscita(l.Item1, l.Item2, l.Item3, l.Item4))));
            var subito = misura();
            System.Threading.Thread.Sleep(1500);
            var dopo = misura();
            Annota("Ingresso e uscita scritti su " + lavori.Count(l => l.Item1 != null) + " oggetti");
            return Risposta.Testo("{\"ok\":true,\"modo\":" + Json.Stringa(dalUi ? "ui" : "diretto") +
                ",\"esiti\":[" + string.Join(",", lavori.Select(l => Json.Stringa(l.Item5))) + "]" +
                ",\"subito\":[" + subito + "],\"dopo_1500_ms\":[" + dopo + "]}");
        }

        /// <summary>Scrive inizio e fine (µm, riferimento del documento) e dice come è andata.</summary>
        private static string ScriviIngressoUscita(object oggetto, Point? inizio, Point? fine, bool dalUi)
        {
            var marcatori = GetReadableMemberValue(oggetto, "EnterExitMarkers") ?? GetReadableMemberValue(oggetto, "myIniEndPoint");
            if (marcatori == null)
            {
                return "l'oggetto non ha EnterExitMarkers";
            }
            var note = new List<string>();
            try
            {
                FindMethodInHierarchy(marcatori.GetType(), "createUndoPoint", Type.EmptyTypes)?.Invoke(marcatori, null);
            }
            catch (Exception ex)
            {
                note.Add("annulla: " + DescribeException(ex));
            }
            // ingresso e uscita contano solo se abilitati (InizioFineStato: Disabled 0, Enabled 1)
            var stato = marcatori.GetType().GetProperty("InizioFineStato", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            if (stato != null && Convert.ToInt32(stato.GetValue(marcatori, null)) != 1)
            {
                try
                {
                    stato.SetValue(marcatori, Enum.ToObject(stato.PropertyType, 1), null);
                    note.Add("abilitati");
                }
                catch (Exception ex)
                {
                    note.Add("abilitarli: " + DescribeException(ex));
                }
            }
            foreach (var coppia in new[] { Tuple.Create("PuntoInizio", inizio), Tuple.Create("PuntoFine", fine) })
            {
                if (!coppia.Item2.HasValue)
                {
                    continue;
                }
                var punto = GetReadableMemberValue(marcatori, coppia.Item1);
                var metodo = FindMethodInHierarchy(punto?.GetType(), dalUi ? "setPointFromUI" : "setPoint", new[] { typeof(Point) });
                if (metodo == null)
                {
                    note.Add(coppia.Item1 + ": metodo non trovato");
                    continue;
                }
                try
                {
                    metodo.Invoke(punto, new object[] { coppia.Item2.Value });
                    note.Add(coppia.Item1 + " scritto");
                }
                catch (Exception ex)
                {
                    note.Add(coppia.Item1 + ": " + DescribeException(ex));
                }
            }
            return string.Join(" · ", note);
        }

        /// <summary>Un oggetto: inizio e fine scelti, primo e ultimo punto cucito, e quanto distano da quelli chiesti.</summary>
        private static string DescriviIngressoUscita(object oggetto, int indice, Point? inizioChiesto, Point? fineChiesto)
        {
            var marcatori = GetReadableMemberValue(oggetto, "EnterExitMarkers") ?? GetReadableMemberValue(oggetto, "myIniEndPoint");
            Func<string, Point?> marcatore = nome =>
            {
                var p = GetReadableMemberValue(GetReadableMemberValue(marcatori, nome), "Point");
                return p is Point q && q.X != NonScelto ? q : (Point?)null;
            };
            var cuciti = FindMethodInHierarchy(oggetto.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(oggetto, null) as TAGGEDPOINT[] ?? new TAGGEDPOINT[0];
            var stato = marcatori?.GetType().GetProperty("InizioFineStato", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(marcatori, null);
            Func<Point?, string> mm = p => p.HasValue ? "[" + Json.Numero(p.Value.X / 1000.0) + "," + Json.Numero(p.Value.Y / 1000.0) + "]" : "null";
            Func<Point?, Point?, string> scarto = (a, b) => a.HasValue && b.HasValue
                ? Json.Numero(Math.Round(Math.Sqrt(Math.Pow(a.Value.X - b.Value.X, 2) + Math.Pow(a.Value.Y - b.Value.Y, 2)) / 1000.0, 3))
                : "null";
            Point? primoPunto = cuciti.Length > 0 ? new Point(cuciti[0].X, cuciti[0].Y) : (Point?)null;
            Point? ultimoPunto = cuciti.Length > 0 ? new Point(cuciti[cuciti.Length - 1].X, cuciti[cuciti.Length - 1].Y) : (Point?)null;
            return "{\"indice\":" + indice +
                   ",\"stato\":" + Json.Stringa(Convert.ToString(stato)) +
                   ",\"inizio_mm\":" + mm(marcatore("PuntoInizio")) +
                   ",\"fine_mm\":" + mm(marcatore("PuntoFine")) +
                   ",\"ingresso_mm\":" + mm(marcatore("PuntoIngresso")) +
                   ",\"uscita_mm\":" + mm(marcatore("PuntoUscita")) +
                   ",\"punti\":" + cuciti.Length +
                   ",\"primo_punto_mm\":" + mm(primoPunto) +
                   ",\"ultimo_punto_mm\":" + mm(ultimoPunto) +
                   ",\"primo_dal_chiesto_mm\":" + scarto(primoPunto, inizioChiesto) +
                   ",\"ultimo_dal_chiesto_mm\":" + scarto(ultimoPunto, fineChiesto) + "}";
        }
    }
}
