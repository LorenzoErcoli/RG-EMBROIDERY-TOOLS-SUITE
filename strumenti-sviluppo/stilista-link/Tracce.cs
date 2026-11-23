using System;
using System.IO;
using System.Linq;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// LE TRACCE RG NEL DOCUMENTO (2026-11-12, Lorenzo: «dammi la possibilità di spegnere e accendere perché io ho paura
    /// che poi mi sgamano quelli del software di Stilista»). Accese, gli oggetti mandati dai tool hanno un nome «RG …»
    /// nella descrizione e i parametri dopo « #rg1:». Spente, nella descrizione non va niente: resta vuota.
    ///
    /// La scelta vale per tutte le finestre e resta da un avvio all'altro: sta in tracce.txt nella cartella del plugin
    /// (PLUG-INS\RGStilistaLink), che una nuova installazione non tocca e la disinstallazione cancella. Si legge a ogni
    /// scrittura, così una finestra già aperta segue subito. Qui non c'è niente di Stilista: si prova da solo
    /// (strumenti-sviluppo/stilista-link-prove).
    /// </summary>
    internal static class Tracce
    {
        /// <summary>Senza tracce.txt (la prima installazione): spente. Accenderle è una scelta.</summary>
        internal const bool DiSerie = false;

        internal const string MarcaParametri = " #rg1:";

        /// <summary>Come cominciano le descrizioni che scrive il plugin, dal 2026-10-20 a oggi.</summary>
        internal static readonly string[] Prefissi = { "RG Tools · ", "RG raso · ", "RG dst · ", "RG infittita · " };

        private static string _file;

        internal static string File
        {
            get
            {
                if (_file == null)
                {
                    var cartella = Directory.GetParent(Configurazione.CartellaPlugin)?.FullName ?? Configurazione.CartellaPlugin;
                    _file = Path.Combine(cartella, "tracce.txt");
                }
                return _file;
            }
            set { _file = value; }
        }

        internal static bool Scelte
        {
            get { return System.IO.File.Exists(File); }
        }

        internal static bool Accese
        {
            get
            {
                try
                {
                    if (System.IO.File.Exists(File))
                    {
                        return System.IO.File.ReadAllText(File).Trim() == "accese";
                    }
                }
                catch
                {
                }
                return DiSerie;
            }
        }

        internal static void Imposta(bool accese)
        {
            System.IO.File.WriteAllText(File, accese ? "accese" : "spente");
        }

        /// <summary>Quello che si scrive davvero nella descrizione: con le tracce spente, niente.</summary>
        internal static string DaScrivere(string voluta)
        {
            return Accese ? voluta : "";
        }

        /// <summary>Una descrizione scritta dal plugin: un nome «RG …» o i parametri.</summary>
        internal static bool ENostra(string descrizione)
        {
            return !string.IsNullOrEmpty(descrizione) &&
                   (Prefissi.Any(p => descrizione.StartsWith(p, StringComparison.Ordinal)) ||
                    descrizione.IndexOf(MarcaParametri, StringComparison.Ordinal) >= 0);
        }
    }
}
