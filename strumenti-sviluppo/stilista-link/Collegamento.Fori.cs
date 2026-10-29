using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>Un contorno chiuso di un oggetto: l'esterno o un foro, in µm.</summary>
    internal sealed class Anello
    {
        public List<int[]> Punti;
        public bool Foro;
        /// <summary>Da dove viene: "contorno" (SourcePath, diviso ai salti) o "vuota" (EmptyAreaPaths).</summary>
        public string Da;
    }

    /// <summary>
    /// I fori degli oggetti di Stilista: le aree vuote del riempimento (EmptyAreaPaths, GMIPath[]) e, se il
    /// contorno ha più anelli separati da salti, quelli che stanno dentro il più grande.
    /// </summary>
    public sealed partial class CodexTab
    {
        /// <summary>Tag che, in un contorno, possono separare un anello dal successivo: salto (bit 1) e inizio blocco (bit 6).</summary>
        private const int TagNuovoAnello = (1 << 1) | (1 << 6);

        private static List<Anello> Anelli(object designObject)
        {
            var orologio = System.Diagnostics.Stopwatch.StartNew();
            var anelli = new List<Anello>();
            // il contorno intero; se dei punti portano un salto o un inizio blocco, lì comincia un altro anello
            // (GMIPathTAGGED.Strokes() NON sono gli anelli: su una macchia di 98 punti, senza fori, dà 11
            // «tratti» per oltre 300 punti — e su SH295 non finiva più)
            var tutti = PuntiConTag(GetReadableMemberValue(designObject, "SourcePath"));
            var corrente = new List<int[]>();
            foreach (var p in tutti)
            {
                if (corrente.Count >= 3 && (p[2] & TagNuovoAnello) != 0)
                {
                    anelli.Add(new Anello { Punti = corrente, Da = "contorno" });
                    corrente = new List<int[]>();
                }
                corrente.Add(p);
            }
            if (corrente.Count >= 2)
            {
                anelli.Add(new Anello { Punti = corrente, Da = "contorno" });
            }
            // più anelli nel contorno: il più grande è l'esterno, quelli che ci stanno dentro sono fori
            if (anelli.Count > 1)
            {
                var esterno = anelli.OrderByDescending(a => Math.Abs(Area(a.Punti))).First();
                foreach (var a in anelli)
                {
                    a.Foro = !ReferenceEquals(a, esterno) && Dentro(a.Punti[0], esterno.Punti);
                }
            }
            // le aree vuote del riempimento (GMIPath[])
            if (GetReadableMemberValue(designObject, "EmptyAreaPaths") is IEnumerable vuote)
            {
                foreach (var percorso in vuote)
                {
                    var punti = PuntiDiUnPercorso(percorso);
                    if (punti.Count >= 3)
                    {
                        anelli.Add(new Anello { Punti = punti, Foro = true, Da = "vuota" });
                    }
                }
            }
            if (orologio.ElapsedMilliseconds > 500)
            {
                ProbeLog.Write("RGLink.Anelli: lento, " + orologio.ElapsedMilliseconds + " ms, " + tutti.Count + " punti");
            }
            return anelli;
        }
        private static List<int[]> PuntiDiUnPercorso(object percorso)
        {
            if (FindMethodInHierarchy(percorso?.GetType(), "GetTaggedPoints", Type.EmptyTypes)?.Invoke(percorso, null) is TAGGEDPOINT[] punti)
            {
                return punti.Select(p => new[] { p.X, p.Y, p.Tag }).ToList();
            }
            return PuntiConTag(percorso);
        }

        private static double Area(List<int[]> punti)
        {
            double a = 0;
            for (int i = 0, j = punti.Count - 1; i < punti.Count; j = i++)
            {
                a += (double)punti[j][0] * punti[i][1] - (double)punti[i][0] * punti[j][1];
            }
            return a / 2;
        }

        private static bool Dentro(int[] p, List<int[]> anello)
        {
            var dentro = false;
            for (int i = 0, j = anello.Count - 1; i < anello.Count; j = i++)
            {
                var a = anello[i];
                var b = anello[j];
                if ((a[1] > p[1]) != (b[1] > p[1]) &&
                    p[0] < (double)(b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
                {
                    dentro = !dentro;
                }
            }
            return dentro;
        }

        /// <summary>
        /// GET /fori — per la ricerca: per ogni oggetto del documento (o ?oggetti=…) i suoi anelli, da dove
        /// vengono e quali sono fori. Solo gli oggetti con più di un anello, se non se ne chiedono di precisi.
        /// </summary>
        private object Fori()
        {
            var tutti = string.IsNullOrEmpty(_oggettiChiesti)
                ? SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"))
                : Selezionati();
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var primo = true;
            for (var i = 0; i < tutti.Count; i++)
            {
                ReadEmgObjectType(tutti[i], out var tipo, out _);
                // i manuali sono punti e basta (SH295 ne ha uno da 129.593): niente fori da cercare
                if (string.IsNullOrEmpty(_oggettiChiesti) && string.Equals(tipo, "Manual", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                var anelli = Anelli(tutti[i]);
                var vuote = GetReadableMemberValue(tutti[i], "EmptyAreaPaths");
                if (string.IsNullOrEmpty(_oggettiChiesti) && anelli.Count < 2)
                {
                    continue;
                }
                if (!primo) sb.Append(',');
                primo = false;
                sb.Append("{\"indice\":").Append(i)
                  .Append(",\"tipo\":").Append(Json.Stringa(tipo))
                  .Append(",\"vuote_tipo\":").Append(Json.Stringa(vuote?.GetType().FullName))
                  .Append(",\"anelli\":[")
                  .Append(string.Join(",", anelli.Select(a =>
                      "{\"da\":" + Json.Stringa(a.Da) + ",\"foro\":" + (a.Foro ? "true" : "false") +
                      ",\"punti\":" + a.Punti.Count + ",\"area_mm2\":" + Json.Numero(Math.Abs(Area(a.Punti)) / 1e6) + "}")))
                  .Append("]}");
            }
            return Risposta.Testo(sb.Append("],\"totale\":").Append(tutti.Count).Append('}').ToString());
        }
    }
}
