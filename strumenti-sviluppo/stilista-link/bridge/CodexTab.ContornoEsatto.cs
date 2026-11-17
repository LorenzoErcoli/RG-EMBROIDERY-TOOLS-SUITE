using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// Il contorno esatto di un oggetto di POST /oggetti (2026-11-17).
    ///
    /// Il bridge crea fill e running col flusso a mano di Stilista (InputContornoAMano): ogni punto passa per
    /// ToPhysicalPoint, cioè in pixel dello schermo, quindi il contorno dipendeva dallo zoom. Su un pannello di
    /// 358 × 681 mm visto intero un pixel è 0,677 mm: i contorni cadevano su quella griglia, e una macchia di
    /// 2,7 × 4,3 mm diventava 4 × 6 pixel (ricalcolo GenericError, 0 punti).
    ///
    /// Adesso il clic a mano serve solo a far nascere l'oggetto: si immette una copia della forma, rimpicciolita
    /// o ingrandita a ~200 pixel e messa al centro della parte visibile (così non dipende né dallo zoom né da dove
    /// guarda la finestra). Poi il contorno diventa quello chiesto, al micron (SourcePath.CopyOfPoints, come
    /// /riempimenti e /running), la linea d'orientamento quella della forma vera (OrientationLines.setPoints, come
    /// /riempimenti), e solo allora Stilista ricalcola.
    /// </summary>
    public sealed partial class CodexTab
    {
        /// <summary>Quanti pixel misura, sul lato lungo, la copia che si immette col clic a mano.</summary>
        private const double PixelDellaCopiaImmessa = 200.0;

        /// <summary>Lo scarto massimo ammesso fra il contorno chiesto e quello che resta nell'oggetto.</summary>
        private const double ScartoMassimoContornoMm = 0.01;

        /// <summary>I punti chiesti, in micron, senza i doppioni di fila (al micron).</summary>
        private static List<Point> PuntiInMicron(List<double[]> percorso)
        {
            var punti = new List<Point>();
            foreach (var p in percorso ?? new List<double[]>())
            {
                if (p == null || p.Length < 2 || double.IsNaN(p[0]) || double.IsNaN(p[1]) ||
                    double.IsInfinity(p[0]) || double.IsInfinity(p[1]))
                {
                    continue;
                }
                var q = new Point(JsonBridge.MillimetersToMicrons(p[0]), JsonBridge.MillimetersToMicrons(p[1]));
                if (punti.Count == 0 || punti[punti.Count - 1] != q)
                {
                    punti.Add(q);
                }
            }
            return punti;
        }

        /// <summary>
        /// La copia da immettere col clic a mano, in mm come i punti chiesti: stessa forma, scalata attorno al
        /// centro del suo riquadro e portata al centro della parte visibile della finestra. Se la trasformazione
        /// dello schermo non si legge, la forma vera, come prima.
        /// </summary>
        private static List<double[]> CopiaDaImmettere(
            object nativeBox,
            List<Point> esatti,
            string logPrefix)
        {
            var vera = esatti.Select(p => new[] { p.X / 1000.0, p.Y / 1000.0 }).ToList();
            try
            {
                var toPhysical = FindPointTransformMethod(nativeBox.GetType(), "ToPhysicalPoint");
                var vista = nativeBox as Control;
                if (toPhysical == null || vista == null || vista.ClientSize.Width < 50 || vista.ClientSize.Height < 50)
                {
                    ProbeLog.Write(logPrefix + ": trasformazione o finestra non leggibile, immetto la forma vera");
                    return vera;
                }

                // lo schermo è x' = x0 + ax·x, y' = y0 + ay·y (in pixel per micron): lo si misura su 10 cm
                const int prova = 100000;
                var p0 = (Point)toPhysical.Invoke(nativeBox, new object[] { new Point(0, 0) });
                var px = (Point)toPhysical.Invoke(nativeBox, new object[] { new Point(prova, 0) });
                var py = (Point)toPhysical.Invoke(nativeBox, new object[] { new Point(0, prova) });
                var ax = (px.X - p0.X) / (double)prova;
                var ay = (py.Y - p0.Y) / (double)prova;
                if (Math.Abs(ax) < 1e-9 || Math.Abs(ay) < 1e-9 || px.Y != p0.Y || py.X != p0.X)
                {
                    ProbeLog.Write(logPrefix + ": schermo non leggibile (" + p0 + " " + px + " " + py + "), immetto la forma vera");
                    return vera;
                }

                int x0 = esatti.Min(p => p.X), x1 = esatti.Max(p => p.X), y0 = esatti.Min(p => p.Y), y1 = esatti.Max(p => p.Y);
                var latoPixel = Math.Max((x1 - x0) * Math.Abs(ax), (y1 - y0) * Math.Abs(ay));
                var obiettivo = Math.Min(PixelDellaCopiaImmessa, 0.6 * Math.Min(vista.ClientSize.Width, vista.ClientSize.Height));
                var k = latoPixel > 0 ? obiettivo / latoPixel : 1.0;
                double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0;
                // il centro della parte visibile, in micron
                var vx = (vista.ClientSize.Width / 2.0 - p0.X) / ax;
                var vy = (vista.ClientSize.Height / 2.0 - p0.Y) / ay;
                ProbeLog.Write(
                    logPrefix + ": 1 px = " + (1.0 / Math.Abs(ax) / 1000.0).ToString("0.####") + " mm, forma " +
                    latoPixel.ToString("0.#") + " px, immessa x" + k.ToString("0.###") + " al centro della vista (" +
                    (vx / 1000.0).ToString("0.###") + ", " + (vy / 1000.0).ToString("0.###") + " mm)");
                return esatti
                    .Select(p => new[] { (vx + (p.X - cx) * k) / 1000.0, (vy + (p.Y - cy) * k) / 1000.0 })
                    .ToList();
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": " + DescribeException(ex) + ", immetto la forma vera");
                return vera;
            }
        }

        /// <summary>
        /// Il contorno dell'oggetto diventa quello chiesto. I tag dei punti sono quelli che il clic a mano ha dato al
        /// primo, all'ultimo e (il più frequente) ai punti di mezzo; chiuso o aperto come l'ha fatto Stilista.
        /// Restituisce i punti scritti, o null col motivo.
        /// </summary>
        private static List<Point> RiscriviContornoEsatto(
            object designObject,
            List<Point> esatti,
            bool chiuso,
            out string motivo)
        {
            motivo = null;
            var percorso = GetReadableMemberValue(designObject, "SourcePath");
            var copia = percorso?.GetType().GetProperty("CopyOfPoints", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            if (copia == null || !copia.CanWrite)
            {
                motivo = "il contorno dell'oggetto non si può riscrivere (SourcePath.CopyOfPoints manca)";
                return null;
            }

            var immessi = PuntiConTag(percorso);
            var tag = immessi.Select(p => p[2]).ToList();
            var tagPrimo = tag.Count > 0 ? tag[0] : 0;
            var tagUltimo = tag.Count > 0 ? tag[tag.Count - 1] : 0;
            var tagMezzo = tag.Count > 2
                ? tag.Skip(1).Take(tag.Count - 2).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key
                : tagPrimo;
            var punti = new List<Point>(esatti);
            if (chiuso && punti[0] != punti[punti.Count - 1])
            {
                punti.Add(punti[0]);
            }
            var tagged = punti
                .Select((p, i) => new TAGGEDPOINT(p.X, p.Y, i == 0 ? tagPrimo : i == punti.Count - 1 ? tagUltimo : tagMezzo))
                .ToArray();
            copia.SetValue(percorso, tagged, null);
            return punti;
        }

        /// <summary>Lo scarto più grande, in mm, fra il contorno dell'oggetto e i punti voluti; infinito se il numero di punti non torna.</summary>
        private static double ScartoDelContorno(object designObject, List<Point> voluti, out int letti)
        {
            var veri = PuntiConTag(GetReadableMemberValue(designObject, "SourcePath"));
            letti = veri.Count;
            if (voluti == null || veri.Count != voluti.Count)
            {
                return double.PositiveInfinity;
            }
            var peggiore = 0.0;
            for (var i = 0; i < veri.Count; i++)
            {
                var dx = veri[i][0] - voluti[i].X;
                var dy = veri[i][1] - voluti[i].Y;
                peggiore = Math.Max(peggiore, Math.Sqrt((double)dx * dx + (double)dy * dy) / 1000.0);
            }
            return peggiore;
        }

        /// <summary>
        /// La linea d'orientamento della forma vera: lo stesso segmento che il bridge dava coi clic (BuildOrientationSegment),
        /// ma in micron. Restituisce null o il motivo.
        /// </summary>
        private static string ImpostaOrientamentoEsatto(object designObject, List<Point> esatti, double gradi)
        {
            var linee = GetReadableMemberValue(designObject, "OrientationLines");
            var imposta = FindMethodInHierarchy(linee?.GetType(), "setPoints", new[] { typeof(List<Point>) });
            if (imposta == null)
            {
                return "la linea d'orientamento non si può scrivere (OrientationLines.setPoints manca)";
            }
            int x0 = esatti.Min(p => p.X), x1 = esatti.Max(p => p.X), y0 = esatti.Min(p => p.Y), y1 = esatti.Max(p => p.Y);
            var segmento = BuildOrientationSegment(x0, y0, x1, y1, gradi);
            if (segmento[0] == segmento[1])
            {
                return "la forma è troppo piccola per una linea d'orientamento (" + (x1 - x0) + " × " + (y1 - y0) + " µm)";
            }
            imposta.Invoke(linee, new object[] { new List<Point>(segmento) });
            var lette = FindMethodInHierarchy(linee.GetType(), "GetSimplePoints", Type.EmptyTypes)?.Invoke(linee, null) as Point[];
            if (lette == null || lette.Length < 2 || lette[0] != segmento[0] || lette[lette.Length - 1] != segmento[1])
            {
                return "la linea d'orientamento non è rimasta quella scritta";
            }
            return null;
        }
    }
}
