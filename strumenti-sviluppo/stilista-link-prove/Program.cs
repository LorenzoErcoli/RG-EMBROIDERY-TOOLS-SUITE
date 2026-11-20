using System;
using System.IO;

namespace StilistaHostSkeleton
{
    /// <summary>Le prove dell'interruttore delle tracce (Tracce.cs). Scrive solo in una cartella temporanea sua.</summary>
    internal static class Program
    {
        private static int _falliti;

        private static void Controlla(string cosa, bool vero)
        {
            Console.WriteLine((vero ? "  ok   " : "  FAIL ") + cosa);
            if (!vero) _falliti++;
        }

        private static int Main()
        {
            var cartella = Path.Combine(Path.GetTempPath(), "rg-stilista-link-prove-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(cartella);
            try
            {
                Tracce.File = Path.Combine(cartella, "tracce.txt");
                var nome = "RG Tools · raso #rg1:H4sIAAAAAAAA";

                Controlla("senza tracce.txt le tracce sono spente, e non è una scelta", !Tracce.Accese && !Tracce.Scelte);
                Controlla("spente: nella descrizione non va niente", Tracce.DaScrivere(nome) == "");
                Tracce.Imposta(true);
                Controlla("accese: la descrizione è quella voluta", Tracce.Accese && Tracce.Scelte && Tracce.DaScrivere(nome) == nome);
                Tracce.Imposta(false);
                Controlla("rispente: di nuovo niente", !Tracce.Accese && Tracce.DaScrivere(nome) == "");
                File.WriteAllText(Tracce.File, "  accese\r\n");
                Controlla("il file scritto a mano, con spazi e a capo, si legge", Tracce.Accese);
                File.WriteAllText(Tracce.File, "boh");
                Controlla("un file che non dice «accese» vuol dire spente", !Tracce.Accese);

                foreach (var d in new[] { "RG Tools · ricamo", "RG raso · macchia 3", "RG dst · 1", "RG infittita · 2", "base #rg1:abc" })
                {
                    Controlla("«Pulisci» riconosce «" + d + "»", Tracce.ENostra(d));
                }
                foreach (var d in new[] { "", null, "base del cliente", "RGB rosso", "Tools · rg" })
                {
                    Controlla("«Pulisci» lascia stare «" + (d ?? "null") + "»", !Tracce.ENostra(d));
                }
            }
            finally
            {
                Directory.Delete(cartella, true);
            }
            Console.WriteLine(_falliti == 0 ? "tracce: tutto ok" : "tracce: " + _falliti + " falliti");
            return _falliti == 0 ? 0 : 1;
        }
    }
}
