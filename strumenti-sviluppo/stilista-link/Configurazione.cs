using System;
using System.IO;
using System.Linq;
using System.Reflection;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// Quello che cambia da un PC all'altro. L'indirizzo della suite sta in indirizzo.txt accanto al plugin (lo
    /// scrive l'installazione): in sviluppo il server locale, per chi lo prova la suite pubblicata. Il server
    /// risponde alle pagine localhost e a quella dell'indirizzo, a nessun'altra.
    /// </summary>
    internal static class Configurazione
    {
        internal const string SuiteOnline = "https://lorenzoercoli.github.io/RG-EMBROIDERY-TOOLS-SUITE/?stilista={0}#/";

        internal static readonly string CartellaPlugin = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? "";

        /// <summary>La home della suite col segnaposto {0} per la porta: ?stilista resta nell'indirizzo quando si apre un tool.</summary>
        internal static readonly string IndirizzoSuite = LeggiIndirizzo();

        /// <summary>schema://host[:porta] dell'indirizzo della suite, come lo manda il browser nell'intestazione Origin.</summary>
        internal static readonly string OrigineSuite = Uri.TryCreate(string.Format(IndirizzoSuite, 0), UriKind.Absolute, out var u)
            ? u.GetLeftPart(UriPartial.Authority)
            : null;

        /// <summary>Le DLL di Stilista: nella cartella del programma che ha caricato il plugin.</summary>
        internal static string CartellaStilista()
        {
            var base_ = AppDomain.CurrentDomain.BaseDirectory;
            return !string.IsNullOrEmpty(base_) && Directory.Exists(base_) ? base_ : @"C:\GMI\Stilista3.3\bin";
        }

        private static string LeggiIndirizzo()
        {
            try
            {
                var file = Path.Combine(CartellaPlugin, "indirizzo.txt");
                if (File.Exists(file))
                {
                    var riga = File.ReadAllLines(file).Select(r => r.Trim()).FirstOrDefault(r => r.Length > 0 && !r.StartsWith("#"));
                    if (riga != null && (riga.StartsWith("http://") || riga.StartsWith("https://")))
                    {
                        // senza segnaposto la porta va in coda, prima del #/ della home
                        return riga.Contains("{0}") ? riga : riga.TrimEnd('/') + "/?stilista={0}#/";
                    }
                }
            }
            catch
            {
            }
            return SuiteOnline;
        }
    }
}
