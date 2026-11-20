using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// I fori dei riempimenti di POST /oggetti (2026-11-17): geometry.holes, anelli in mm come outer.
    ///
    /// Stilista tiene i fori nelle aree vuote del riempimento, DesignObject.EmptyAreaPaths (GMIPath[]), non nel
    /// contorno (sapere/codice/stilista-fori.md). Ogni foro diventa una copia del contorno (new GMIPathTAGGED(SourcePath):
    /// stesso tipo di percorso) coi punti chiesti al micron (CopyOfPoints), chiusa, coi tag del contorno.
    ///
    /// Prima di creare si controlla che ogni foro stia dentro l'esterno e non tocchi né lui né gli altri fori;
    /// dopo il ricalcolo si rileggono le aree vuote e si guarda che nessun punto cucito stia dentro un foro. Se un
    /// foro non entra, l'oggetto non si crea: mai un riempimento pieno al posto di uno coi buchi.
    /// </summary>
    public sealed partial class CodexTab
    {
        /// <summary>Un punto cucito più dentro di così dal bordo di un foro vuol dire che il foro non c'è.</summary>
        private const double MarginePuntiNelForoMm = 0.3;

        /// <summary>I fori chiesti, in micron, senza doppioni di fila e senza il punto che li chiude.</summary>
        private static List<List<Point>> ForiInMicron(JsonGeometrySpec geometria)
        {
            var fori = new List<List<Point>>();
            foreach (var anello in geometria?.Holes ?? new List<List<double[]>>())
            {
                if (anello == null || anello.Count == 0)
                {
                    continue;
                }
                var punti = PuntiInMicron(anello);
                if (punti.Count >= 2 && punti[0] == punti[punti.Count - 1])
                {
                    punti.RemoveAt(punti.Count - 1);
                }
                fori.Add(punti);
            }
            return fori;
        }

        /// <summary>Cosa non va nei fori rispetto all'esterno (anelli aperti, in µm), o null.</summary>
        private static string ControllaFori(List<Point> esterno, List<List<Point>> fori)
        {
            for (var i = 0; i < fori.Count; i++)
            {
                var foro = fori[i];
                var nome = "il foro " + (i + 1);
                if (foro.Count < 3)
                {
                    return nome + " ha meno di 3 punti distinti al micron";
                }
                if (Math.Abs(AreaDi(foro)) < 1.0)
                {
                    return nome + " non ha area (i punti sono in fila)";
                }
                if (SiIncrocia(foro, foro))
                {
                    return nome + " si incrocia da solo";
                }
                if (!foro.All(p => DentroDi(p, esterno)))
                {
                    return nome + " esce dal contorno esterno";
                }
                if (SiIncrocia(foro, esterno))
                {
                    return nome + " tocca o taglia il contorno esterno";
                }
                for (var j = 0; j < i; j++)
                {
                    if (SiIncrocia(foro, fori[j]) || DentroDi(foro[0], fori[j]) || DentroDi(fori[j][0], foro))
                    {
                        return nome + " tocca il foro " + (j + 1) + " o ci sta dentro";
                    }
                }
            }
            return null;
        }

        /// <summary>Scrive i fori come aree vuote dell'oggetto. Restituisce gli anelli scritti (chiusi), o null col motivo.</summary>
        private static List<List<Point>> ScriviFori(object designObject, List<List<Point>> fori, out string motivo)
        {
            motivo = null;
            var proprieta = designObject.GetType().GetProperty("EmptyAreaPaths", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            var contorno = GetReadableMemberValue(designObject, "SourcePath");
            var elemento = proprieta?.PropertyType.GetElementType();
            var copia = contorno == null ? null : contorno.GetType().GetConstructor(new[] { contorno.GetType() });
            var punti = contorno?.GetType().GetProperty("CopyOfPoints", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            if (proprieta == null || !proprieta.CanWrite || elemento == null || copia == null || punti == null || !punti.CanWrite ||
                !elemento.IsAssignableFrom(contorno.GetType()))
            {
                motivo = "le aree vuote dell'oggetto non si possono scrivere (EmptyAreaPaths o il tipo dei percorsi mancano)";
                return null;
            }

            var tag = PuntiConTag(contorno).Select(p => p[2]).ToList();
            var tagPrimo = tag.Count > 0 ? tag[0] : 0;
            var tagUltimo = tag.Count > 0 ? tag[tag.Count - 1] : 0;
            var tagMezzo = tag.Count > 2
                ? tag.Skip(1).Take(tag.Count - 2).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key
                : tagPrimo;

            var scritti = new List<List<Point>>();
            var percorsi = Array.CreateInstance(elemento, fori.Count);
            for (var i = 0; i < fori.Count; i++)
            {
                var anello = new List<Point>(fori[i]) { fori[i][0] };
                var percorso = copia.Invoke(new[] { contorno });
                punti.SetValue(
                    percorso,
                    anello.Select((p, k) => new TAGGEDPOINT(p.X, p.Y, k == 0 ? tagPrimo : k == anello.Count - 1 ? tagUltimo : tagMezzo)).ToArray(),
                    null);
                percorsi.SetValue(percorso, i);
                scritti.Add(anello);
            }
            proprieta.SetValue(designObject, percorsi, null);
            return scritti;
        }

        /// <summary>
        /// I fori dopo il ricalcolo: le aree vuote sono quelle scritte (stesso numero, stessi punti entro 0,01 mm) e nessun
        /// punto cucito, né la metà di un punto che non sia un salto, sta dentro un foro più di 0,3 mm. Restituisce null o il motivo.
        /// </summary>
        private static string VerificaFori(object designObject, List<List<Point>> scritti)
        {
            var vuote = new List<List<int[]>>();
            if (GetReadableMemberValue(designObject, "EmptyAreaPaths") is IEnumerable lette)
            {
                foreach (var percorso in lette)
                {
                    vuote.Add(PuntiDiUnPercorso(percorso));
                }
            }
            if (vuote.Count != scritti.Count)
            {
                return "l'oggetto ha " + vuote.Count + " aree vuote invece di " + scritti.Count + " fori";
            }
            for (var i = 0; i < scritti.Count; i++)
            {
                if (vuote[i].Count != scritti[i].Count)
                {
                    return "il foro " + (i + 1) + " ha " + vuote[i].Count + " punti invece di " + scritti[i].Count;
                }
                for (var k = 0; k < scritti[i].Count; k++)
                {
                    var d = Math.Sqrt(Math.Pow(vuote[i][k][0] - scritti[i][k].X, 2) + Math.Pow(vuote[i][k][1] - scritti[i][k].Y, 2)) / 1000.0;
                    if (d > ScartoMassimoContornoMm)
                    {
                        return "il foro " + (i + 1) + " si scosta di " + d.ToString("0.###") + " mm dai punti chiesti";
                    }
                }
            }

            var cuciti = FindMethodInHierarchy(designObject.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(designObject, null) as TAGGEDPOINT[];
            if (cuciti == null)
            {
                return "i punti cuciti non si leggono: non si può controllare che i fori siano vuoti";
            }
            var margine = MarginePuntiNelForoMm * 1000.0;
            for (var i = 0; i < scritti.Count; i++)
            {
                var foro = scritti[i];
                var dentro = 0;
                for (var k = 0; k < cuciti.Length; k++)
                {
                    var p = new PointF(cuciti[k].X, cuciti[k].Y);
                    if (DentroPiuDi(p, foro, margine))
                    {
                        dentro++;
                        continue;
                    }
                    // la metà del tratto verso il punto dopo, se quel tratto si cuce (non è un salto)
                    if (k + 1 < cuciti.Length && (cuciti[k + 1].Tag & 2) == 0)
                    {
                        var m = new PointF((cuciti[k].X + cuciti[k + 1].X) / 2f, (cuciti[k].Y + cuciti[k + 1].Y) / 2f);
                        if (DentroPiuDi(m, foro, margine))
                        {
                            dentro++;
                        }
                    }
                }
                if (dentro > 0)
                {
                    return "il foro " + (i + 1) + " non è vuoto: " + dentro + " punti cuciti ci passano dentro";
                }
            }
            return null;
        }

        private static double AreaDi(List<Point> anello)
        {
            double a = 0;
            for (int i = 0, j = anello.Count - 1; i < anello.Count; j = i++)
            {
                a += (double)anello[j].X * anello[i].Y - (double)anello[i].X * anello[j].Y;
            }
            return a / 2;
        }

        private static bool DentroDi(PointF p, List<Point> anello)
        {
            var dentro = false;
            for (int i = 0, j = anello.Count - 1; i < anello.Count; j = i++)
            {
                var a = anello[i];
                var b = anello[j];
                if ((a.Y > p.Y) != (b.Y > p.Y) &&
                    p.X < (double)(b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X)
                {
                    dentro = !dentro;
                }
            }
            return dentro;
        }

        private static bool DentroDi(Point p, List<Point> anello)
        {
            return DentroDi(new PointF(p.X, p.Y), anello);
        }

        /// <summary>Dentro l'anello e più lontano di margine (µm) da ogni suo lato.</summary>
        private static bool DentroPiuDi(PointF p, List<Point> anello, double margine)
        {
            if (!DentroDi(p, anello))
            {
                return false;
            }
            for (int i = 0, j = anello.Count - 1; i < anello.Count; j = i++)
            {
                if (DistanzaDalLato(p, anello[j], anello[i]) <= margine)
                {
                    return false;
                }
            }
            return true;
        }

        private static double DistanzaDalLato(PointF p, Point a, Point b)
        {
            double dx = b.X - a.X, dy = b.Y - a.Y;
            var l2 = dx * dx + dy * dy;
            var t = l2 == 0 ? 0 : Math.Max(0, Math.Min(1, ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / l2));
            var qx = a.X + t * dx - p.X;
            var qy = a.Y + t * dy - p.Y;
            return Math.Sqrt(qx * qx + qy * qy);
        }

        /// <summary>
        /// Due anelli chiusi si toccano o si tagliano. Con lo stesso anello due volte: si incrocia da solo
        /// (i lati vicini, che hanno un vertice in comune, non contano).
        /// </summary>
        private static bool SiIncrocia(List<Point> a, List<Point> b)
        {
            var stesso = ReferenceEquals(a, b);
            for (var i = 0; i < a.Count; i++)
            {
                var a1 = a[i];
                var a2 = a[(i + 1) % a.Count];
                for (var j = stesso ? i + 1 : 0; j < b.Count; j++)
                {
                    if (stesso && (j == i || (j + 1) % b.Count == i || (i + 1) % a.Count == j))
                    {
                        continue;
                    }
                    if (SegmentiSiToccano(a1, a2, b[j], b[(j + 1) % b.Count]))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        private static bool SegmentiSiToccano(Point p1, Point p2, Point q1, Point q2)
        {
            long Verso(Point a, Point b, Point c)
            {
                var v = (long)(b.X - a.X) * (c.Y - a.Y) - (long)(b.Y - a.Y) * (c.X - a.X);
                return v > 0 ? 1 : v < 0 ? -1 : 0;
            }
            bool Sopra(Point a, Point b, Point c)
            {
                return Math.Min(a.X, b.X) <= c.X && c.X <= Math.Max(a.X, b.X) &&
                       Math.Min(a.Y, b.Y) <= c.Y && c.Y <= Math.Max(a.Y, b.Y);
            }
            var d1 = Verso(q1, q2, p1);
            var d2 = Verso(q1, q2, p2);
            var d3 = Verso(p1, p2, q1);
            var d4 = Verso(p1, p2, q2);
            if (d1 * d2 < 0 && d3 * d4 < 0)
            {
                return true;
            }
            return (d1 == 0 && Sopra(q1, q2, p1)) || (d2 == 0 && Sopra(q1, q2, p2)) ||
                   (d3 == 0 && Sopra(p1, p2, q1)) || (d4 == 0 && Sopra(p1, p2, q2));
        }
    }
}
