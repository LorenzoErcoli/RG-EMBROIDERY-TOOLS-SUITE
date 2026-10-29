using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>Le macchie da riempire come un riempimento di Stilista: in mm nel riferimento dell'SVG della selezione.</summary>
    [DataContract]
    internal sealed class RiempimentiChiesti
    {
        [DataMember(Name = "origine_mm")] public double[] OrigineMm { get; set; }
        [DataMember(Name = "macchie")] public List<MacchiaDaRiempire> Macchie { get; set; }
        /// <summary>La direzione dei punti, in gradi (90 = verticale); assente = quella del modello.</summary>
        [DataMember(Name = "orientamento_deg")] public double? OrientamentoDeg { get; set; }
        /// <summary>Ago (da 1); assente = quello del modello.</summary>
        [DataMember(Name = "ago")] public int? Ago { get; set; }
        [DataMember(Name = "nome")] public string Nome { get; set; }
    }

    [DataContract]
    internal sealed class MacchiaDaRiempire
    {
        [DataMember(Name = "contorno_mm")] public List<double[]> ContornoMm { get; set; }
        [DataMember(Name = "inizio_mm")] public double[] InizioMm { get; set; }
        [DataMember(Name = "fine_mm")] public double[] FineMm { get; set; }
    }

    /// <summary>
    /// POST /riempimenti (2026-10-29, Pattern a macchie, Lorenzo: «avere il riempimento raso di stilista ma gestito
    /// dal programma»). Il raso delle macchie lo calcola Stilista: ogni macchia è una COPIA DEL MODELLO — il
    /// riempimento selezionato in Stilista, coi suoi parametri (densità, fase, imbastitura) — col contorno della
    /// macchia, l'orientamento chiesto e l'ingresso e l'uscita decisi dal tool. Le macchie entrano in fondo al
    /// documento nell'ordine in cui arrivano: la sequenza è quella del tool. Ingresso e uscita vanno sul contorno
    /// (sapere/codice/stilista-ingresso-uscita.md). Non sono oggetti «RG Tools · »: la sentinella non li tocca e
    /// Stilista li può ricalcolare.
    /// </summary>
    public sealed partial class CodexTab
    {
        private Risposta RiceviRiempimenti(Richiesta r)
        {
            RiempimentiChiesti chiesti;
            try
            {
                using (var m = new MemoryStream(r.Corpo))
                {
                    chiesti = new DataContractJsonSerializer(typeof(RiempimentiChiesti)).ReadObject(m) as RiempimentiChiesti;
                }
            }
            catch (Exception ex)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa("JSON non valido: " + ex.Message) + "}", stato: 400);
            }
            if (chiesti?.Macchie == null || chiesti.Macchie.Count == 0 || chiesti.OrigineMm == null || chiesti.OrigineMm.Length < 2)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"servono origine_mm e le macchie\"}", stato: 400);
            }
            var esito = (string)NelFiloDiStilista(() => CreaRiempimenti(chiesti));
            if (esito.StartsWith("!", StringComparison.Ordinal))
            {
                Annota("Riempimenti non creati: " + esito.Substring(1));
                return Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa(esito.Substring(1)) + "}", stato: 409);
            }
            return Risposta.Testo(esito);
        }

        private string CreaRiempimenti(RiempimentiChiesti chiesti)
        {
            const string log = "RGLink.Riempimenti";
            var embroidery = Ricamo();
            var oggetti = GetReadableMemberValue(embroidery, "Objects");
            if (embroidery == null || oggetti == null)
            {
                return "!nessun documento aperto";
            }
            var modello = ModelloDiRiempimento(Selezionati());
            if (modello == null)
            {
                return "!seleziona in Stilista un riempimento (per esempio una macchia a raso): fa da modello, coi suoi parametri";
            }
            var ox = chiesti.OrigineMm[0];
            var oy = chiesti.OrigineMm[1];
            Func<double[], Point?> inUm = p => p != null && p.Length >= 2
                ? new Point((int)Math.Round((p[0] + ox) * 1000.0), (int)Math.Round((p[1] + oy) * 1000.0))
                : (Point?)null;

            // i tag del contorno come li ha il modello: il primo, quello dei punti in mezzo, l'ultimo
            var tagModello = PuntiConTag(GetReadableMemberValue(modello, "SourcePath")).Select(p => p[2]).ToList();
            var tagPrimo = tagModello.Count > 0 ? tagModello[0] : 0;
            var tagUltimo = tagModello.Count > 0 ? tagModello[tagModello.Count - 1] : 0;
            var tagMezzo = tagModello.Count > 2
                ? tagModello.Skip(1).Take(tagModello.Count - 2).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key
                : tagPrimo;

            var metti = FindMethodInHierarchy(oggetti.GetType(), "Insert", new[] { typeof(int), modello.GetType() });
            if (metti == null)
            {
                return "!Insert non trovato sulla collezione del documento";
            }
            var primaDi = SnapshotObjects(oggetti).Count;
            var sb = new StringBuilder();
            int fatte = 0, punti = 0;
            double peggioreIngresso = 0, peggioreUscita = 0;
            var errori = new List<string>();
            for (var i = 0; i < chiesti.Macchie.Count; i++)
            {
                var macchia = chiesti.Macchie[i];
                var contorno = (macchia.ContornoMm ?? new List<double[]>()).Select(inUm).Where(p => p.HasValue).Select(p => p.Value).ToList();
                if (contorno.Count < 3)
                {
                    errori.Add((i + 1) + ": contorno con meno di 3 punti");
                    continue;
                }
                if (contorno[0] != contorno[contorno.Count - 1])
                {
                    contorno.Add(contorno[0]); // chiuso, come i contorni di Stilista
                }
                var copia = Clona(modello, embroidery);
                if (copia == null)
                {
                    errori.Add((i + 1) + ": copia del modello non riuscita");
                    continue;
                }
                try
                {
                    // 1. il contorno della macchia, senza aree vuote
                    var percorso = GetReadableMemberValue(copia, "SourcePath");
                    var tagged = contorno.Select((p, k) => new TAGGEDPOINT(p.X, p.Y, k == 0 ? tagPrimo : k == contorno.Count - 1 ? tagUltimo : tagMezzo)).ToArray();
                    percorso?.GetType().GetProperty("CopyOfPoints")?.SetValue(percorso, tagged, null);
                    copia.GetType().GetProperty("EmptyAreaPaths")?.SetValue(copia, Array.CreateInstance(copia.GetType().GetProperty("EmptyAreaPaths").PropertyType.GetElementType(), 0), null);

                    // 2. l'orientamento: un segmento che attraversa la macchia dal centro, nella direzione chiesta
                    //    (o in quella del modello)
                    ImpostaOrientamento(copia, modello, contorno, chiesti.OrientamentoDeg);

                    // 3. nel documento, in fondo: la sequenza è quella del tool
                    ImpostaDescrizione(copia, "RG raso · " + (chiesti.Nome ?? "macchia") + " " + (i + 1));
                    metti.Invoke(oggetti, new object[] { SnapshotObjects(oggetti).Count, copia });
                    if (chiesti.Ago.HasValue && ReadNativeNeedleOneBased(copia) != chiesti.Ago.Value)
                    {
                        TryAssignNativeNeedle(GetReadableMemberValue(embroidery, "ListaFilati"), copia, chiesti.Ago.Value, null, log + ".Ago");
                    }

                    // 4. ingresso e uscita, poi il calcolo del riempimento
                    var inizio = inUm(macchia.InizioMm);
                    var fine = inUm(macchia.FineMm);
                    var note = ScriviIngressoUscita(copia, inizio, fine, true);
                    TrySetBoolMember(copia, "NeedRestitching", true);
                    var calcolo = InvokeDesignObjectRecalc(copia, log);
                    var cuciti = FindMethodInHierarchy(copia.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(copia, null) as TAGGEDPOINT[] ?? new TAGGEDPOINT[0];
                    Func<TAGGEDPOINT, Point?, double> dist = (t, p) => p.HasValue ? Math.Sqrt(Math.Pow(t.X - p.Value.X, 2) + Math.Pow(t.Y - p.Value.Y, 2)) / 1000.0 : 0;
                    var dIn = cuciti.Length > 0 ? dist(cuciti[0], inizio) : double.NaN;
                    var dOut = cuciti.Length > 0 ? dist(cuciti[cuciti.Length - 1], fine) : double.NaN;
                    if (cuciti.Length == 0)
                    {
                        errori.Add((i + 1) + ": 0 punti dopo il calcolo (" + calcolo + ", " + note + ")");
                    }
                    else
                    {
                        fatte++;
                        punti += cuciti.Length;
                        peggioreIngresso = Math.Max(peggioreIngresso, dIn);
                        peggioreUscita = Math.Max(peggioreUscita, dOut);
                    }
                    if (sb.Length > 0) sb.Append(',');
                    sb.Append("{\"macchia\":").Append(i + 1)
                      .Append(",\"punti\":").Append(cuciti.Length)
                      .Append(",\"ingresso_scarto_mm\":").Append(double.IsNaN(dIn) ? "null" : Json.Numero(Math.Round(dIn, 3)))
                      .Append(",\"uscita_scarto_mm\":").Append(double.IsNaN(dOut) ? "null" : Json.Numero(Math.Round(dOut, 3)))
                      .Append(",\"note\":").Append(Json.Stringa(note + " · " + calcolo)).Append('}');
                }
                catch (Exception ex)
                {
                    errori.Add((i + 1) + ": " + DescribeException(ex));
                }
            }
            TryRaiseObjectsRedrawNeeded(oggetti);
            var riassunto = "Riempimenti: " + fatte + " macchie su " + chiesti.Macchie.Count + ", " + punti + " punti, modello «" +
                Convert.ToString(GetReadableMemberValue(modello, "Description")) + "» " + Tipo(modello);
            ProbeLog.Write(log + ": " + riassunto + (errori.Count > 0 ? " · errori: " + string.Join(" | ", errori) : ""));
            Annota(riassunto);
            return "{\"ok\":" + (fatte > 0 ? "true" : "false") +
                   ",\"macchie\":" + fatte + ",\"chieste\":" + chiesti.Macchie.Count +
                   ",\"punti\":" + punti +
                   ",\"oggetti_prima\":" + primaDi + ",\"oggetti_dopo\":" + SnapshotObjects(oggetti).Count +
                   ",\"ingresso_scarto_max_mm\":" + Json.Numero(Math.Round(peggioreIngresso, 3)) +
                   ",\"uscita_scarto_max_mm\":" + Json.Numero(Math.Round(peggioreUscita, 3)) +
                   ",\"ago\":" + Json.Stringa(Convert.ToString(ReadNativeNeedleOneBased(modello))) +
                   ",\"errori\":[" + string.Join(",", errori.Select(Json.Stringa)) + "]" +
                   ",\"dettaglio\":[" + sb + "]}";
        }

        /// <summary>Il modello dei riempimenti: il primo selezionato da ricamo, non laser e non a punti manuali.</summary>
        private static object ModelloDiRiempimento(IEnumerable<object> selezionati)
        {
            foreach (var o in selezionati)
            {
                if (Vero(o, "ContainsLaser") || !Vero(GetReadableMemberValue(o, "Parameters"), "isConRicamo"))
                {
                    continue;
                }
                ReadEmgObjectType(o, out var nome, out _);
                if (string.Equals(nome, "Manual", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                return o;
            }
            return null;
        }

        /// <summary>
        /// Un solo segmento d'orientamento, dal centro della macchia, lungo quanto la macchia: nella direzione chiesta
        /// (gradi, 90 = verticale) o in quella del primo segmento del modello.
        /// </summary>
        private static void ImpostaOrientamento(object copia, object modello, List<Point> contorno, double? gradi)
        {
            var linee = GetReadableMemberValue(copia, "OrientationLines");
            var imposta = FindMethodInHierarchy(linee?.GetType(), "setPoints", new[] { typeof(List<Point>) });
            if (imposta == null)
            {
                return;
            }
            double dx, dy;
            if (gradi.HasValue)
            {
                dx = Math.Cos(gradi.Value * Math.PI / 180.0);
                dy = Math.Sin(gradi.Value * Math.PI / 180.0);
            }
            else
            {
                var delModello = FindMethodInHierarchy(GetReadableMemberValue(modello, "OrientationLines")?.GetType(), "GetSimplePoints", Type.EmptyTypes)
                    ?.Invoke(GetReadableMemberValue(modello, "OrientationLines"), null) as Point[];
                if (delModello == null || delModello.Length < 2 || delModello[0] == delModello[1])
                {
                    return;
                }
                var l = Math.Sqrt(Math.Pow(delModello[1].X - delModello[0].X, 2) + Math.Pow(delModello[1].Y - delModello[0].Y, 2));
                dx = (delModello[1].X - delModello[0].X) / l;
                dy = (delModello[1].Y - delModello[0].Y) / l;
            }
            int x0 = contorno.Min(p => p.X), x1 = contorno.Max(p => p.X), y0 = contorno.Min(p => p.Y), y1 = contorno.Max(p => p.Y);
            double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0, mezzo = Math.Sqrt(Math.Pow(x1 - x0, 2) + Math.Pow(y1 - y0, 2)) / 2.0 + 1000;
            imposta.Invoke(linee, new object[] { new List<Point>
            {
                new Point((int)Math.Round(cx - dx * mezzo), (int)Math.Round(cy - dy * mezzo)),
                new Point((int)Math.Round(cx + dx * mezzo), (int)Math.Round(cy + dy * mezzo)),
            } });
        }
    }
}
