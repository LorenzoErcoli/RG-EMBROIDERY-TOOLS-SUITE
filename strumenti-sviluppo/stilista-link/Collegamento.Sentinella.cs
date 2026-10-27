using System;
using System.Linq;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// LA SENTINELLA (2026-10-21). Un ricamo tornato da un tool è un oggetto a punti manuali il cui CONTORNO
    /// sono i nostri punti; ogni ricalcolo di Stilista lo ripercorre con la sua lunghezza punto e lo rovina
    /// (773 punti → 346; e non solo all'inserimento: nel ritorno di Lorenzo delle 09:49, 70.221 punti, Stilista
    /// l'ha ricalcolato ancora a 6,9 e a 11 s, quando il guardiano di 15 s stava per smettere). La regola:
    /// in un oggetto RG Tools i punti cuciti sono uguali al contorno. Ogni secondo, sul filo dell'interfaccia,
    /// gli oggetti la cui descrizione comincia per «RG Tools · » si controllano, e se i punti non sono più il
    /// contorno si riscrivono. Spostarlo o ruotarlo muove contorno e punti insieme: la regola regge e non
    /// si annulla niente. Per modificarne i punti a mano in Stilista si toglie «RG Tools» dalla descrizione.
    /// </summary>
    public sealed partial class CodexTab
    {
        internal const string PrefissoDescrizione = "RG Tools · ";
        private static System.Windows.Forms.Timer _sentinella;
        private static CodexTab _sentinellaDi;

        /// <summary>L'oggetto selezionato da cui è partito il lavoro: il ricamo che torna ne è una copia.</summary>
        private object _modelloRitorno;

        private void AvviaSentinella()
        {
            if (_sentinella != null)
            {
                return;
            }
            _sentinellaDi = this;
            _sentinella = new System.Windows.Forms.Timer { Interval = 1000 };
            _sentinella.Tick += (s, e) => _sentinellaDi?.Sorveglia();
            _sentinella.Start();
            ProbeLog.Write("RGLink.Sentinella: avviata");
        }

        private int Sorveglia()
        {
            var rimessi = 0;
            try
            {
                foreach (var oggetto in SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects")))
                {
                    var descrizione = Convert.ToString(GetReadableMemberValue(oggetto, "Description"));
                    if (descrizione == null || !descrizione.StartsWith(PrefissoDescrizione, StringComparison.Ordinal))
                    {
                        continue;
                    }
                    var contorno = FindMethodInHierarchy(GetReadableMemberValue(oggetto, "SourcePath")?.GetType(), "GetTaggedPoints", Type.EmptyTypes)
                        ?.Invoke(GetReadableMemberValue(oggetto, "SourcePath"), null) as TAGGEDPOINT[];
                    var cuciti = FindMethodInHierarchy(oggetto.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(oggetto, null) as TAGGEDPOINT[];
                    if (contorno == null || contorno.Length < 2 || cuciti == null || Uguali(contorno, cuciti))
                    {
                        continue;
                    }
                    FindMethodInHierarchy(oggetto.GetType(), "OldPoints2StitchPath", new[] { typeof(TAGGEDPOINT[]) })?.Invoke(oggetto, new object[] { contorno });
                    TrySetBoolMember(oggetto, "NeedRestitching", false);
                    rimessi++;
                    ProbeLog.Write("RGLink.Sentinella: «" + descrizione + "» ricalcolato da Stilista (" + cuciti.Length +
                        " punti invece di " + contorno.Length + "): rimessi i punti del contorno");
                }
                if (rimessi > 0)
                {
                    TryRaiseObjectsRedrawNeeded(GetReadableMemberValue(Ricamo(), "Objects"));
                }
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.Sentinella: " + DescribeException(ex));
            }
            return rimessi;
        }

        private static bool Uguali(TAGGEDPOINT[] a, TAGGEDPOINT[] b)
        {
            if (a.Length != b.Length)
            {
                return false;
            }
            for (var i = 0; i < a.Length; i++)
            {
                if (a[i].X != b[i].X || a[i].Y != b[i].Y || a[i].Tag != b[i].Tag)
                {
                    return false;
                }
            }
            return true;
        }

        [ThreadStatic] private static bool _sblocca;

        /// <summary>
        /// POST /ricalcola?oggetti=…[&amp;sblocca=1] — per le prove: ricalcola quegli oggetti come farebbe Stilista
        /// (NeedRestitching + RicalcolaDiretta; con sblocca=1 prima toglie il lucchetto) e dice quanti punti
        /// avevano prima e dopo. La sentinella, se serve, li rimette entro un secondo.
        /// </summary>
        private object Ricalcola()
        {
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var primo = true;
            foreach (var oggetto in Selezionati())
            {
                var prima = ContaPunti(oggetto);
                if (_sblocca)
                {
                    TrySetBoolMember(oggetto, "LockRecalc", false); // il caso peggiore: senza lucchetto
                }
                TrySetBoolMember(oggetto, "NeedRestitching", true);
                var esito = InvokeDesignObjectRecalc(oggetto, "RGLink.Ricalcola");
                var dopo = ContaPunti(oggetto);
                if (!primo) sb.Append(',');
                primo = false;
                sb.Append("{\"descrizione\":").Append(Json.Stringa(Convert.ToString(GetReadableMemberValue(oggetto, "Description"))))
                  .Append(",\"esito\":").Append(Json.Stringa(esito))
                  .Append(",\"prima\":").Append(prima).Append(",\"dopo\":").Append(dopo).Append('}');
            }
            return Risposta.Testo(sb.Append("]}").ToString());
        }
    }
}
