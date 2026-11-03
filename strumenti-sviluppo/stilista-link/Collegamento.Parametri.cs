using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// I PARAMETRI NELL'OGGETTO (2026-11-03, Lorenzo: «non so come né dove salvarmi i parametri di creazione delle
    /// cose fatte con i tools»). Un tool manda, con l'oggetto, il suo progetto già impacchettato; qui lo si scrive in
    /// coda alla descrizione dell'oggetto, che Stilista salva nell'.emg3 e porta con sé nel salva con nome, nel
    /// ricalcolo e nel copia e incolla fra documenti, e che nessuna finestra di Stilista mostra o cambia
    /// (sapere/codice/stilista-parametri-nell-oggetto.md). Il plugin non guarda dentro al pacchetto: è testo.
    /// </summary>
    public sealed partial class CodexTab
    {
        internal const string MarcaParametri = " #rg1:";
        private const string EstensioneParametriDst = ".rgp";

        private static string ConParametri(string nome, string parametri)
        {
            return string.IsNullOrEmpty(parametri) ? nome : nome + MarcaParametri + parametri;
        }

        /// <summary>La descrizione senza i parametri: è quella che va nel registro e nelle risposte.</summary>
        internal static string SenzaParametri(string descrizione)
        {
            var i = descrizione?.IndexOf(MarcaParametri, StringComparison.Ordinal) ?? -1;
            return i >= 0 ? descrizione.Substring(0, i) : descrizione;
        }

        private static string ParametriDi(object oggetto)
        {
            var descrizione = Convert.ToString(GetReadableMemberValue(oggetto, "Description"));
            var i = descrizione?.IndexOf(MarcaParametri, StringComparison.Ordinal) ?? -1;
            return i >= 0 ? descrizione.Substring(i + MarcaParametri.Length) : null;
        }

        /// <summary>GET /parametri: il progetto del primo oggetto selezionato che ne ha uno, e quanti ne hanno uno.</summary>
        private object ParametriSelezione()
        {
            var selezionati = Selezionati();
            var trovati = selezionati.Select(ParametriDi).Where(p => p != null).ToList();
            return Risposta.Testo("{\"ok\":true,\"oggetti\":" + selezionati.Count +
                ",\"con_parametri\":" + trovati.Count +
                ",\"diversi\":" + trovati.Distinct().Count() +
                ",\"parametri\":" + Json.Stringa(trovati.FirstOrDefault()) + "}");
        }

        /// <summary>
        /// Toglie i parametri da tutti gli oggetti del documento (Lorenzo, 2026-11-03: «quando scriviamo nel file emg
        /// se poi posso cancellare i dati»). Il nome resta. Dopo il salvataggio nell'.emg3 non ne resta traccia, ma i
        /// .Bak di Stilista hanno ancora la versione di prima, e gli oggetti incollati altrove i loro.
        /// </summary>
        private int TogliParametri()
        {
            var tolti = 0;
            foreach (var oggetto in SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects")))
            {
                if (ParametriDi(oggetto) != null)
                {
                    ImpostaDescrizione(oggetto, SenzaParametri(Convert.ToString(GetReadableMemberValue(oggetto, "Description"))));
                    tolti++;
                }
            }
            ProbeLog.Write("RGLink.Parametri: tolti da " + tolti + " oggetti");
            return tolti;
        }

        /// <summary>POST /togli-parametri: lo stesso del pulsante, senza chiedere.</summary>
        private object RiceviTogliParametri()
        {
            return Risposta.Testo("{\"ok\":true,\"tolti\":" + TogliParametri() + "}");
        }

        /// <summary>Il pulsante della scheda RG_LINK: chiede conferma, poi ricorda di salvare.</summary>
        private void PulsanteTogliParametri()
        {
            var quanti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects")).Count(o => ParametriDi(o) != null);
            if (quanti == 0)
            {
                Annota("In questo documento non ci sono parametri da togliere");
                return;
            }
            var risposta = MessageBox.Show(_stilista?.Form,
                "Togliere i parametri da " + quanti + " oggetti di questo documento?\n\nDopo non si potranno più riaprire nel tool. I ricami restano come sono.",
                "RG Tools", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
            if (risposta == DialogResult.Yes)
            {
                Annota("Tolti da " + TogliParametri() + " oggetti: ora salva il documento. Le copie .Bak di Stilista hanno ancora la versione di prima");
            }
        }

        /// <summary>
        /// Un DST si apre in un altro processo (LoadNewEmb), che di quel che ha ricevuto questo non sa niente: i
        /// parametri lo aspettano in un file accanto al DST (RiceviDst), e la finestra che ha aperto quel DST li
        /// scrive nei suoi oggetti. Li legge la sentinella, che gira ogni secondo.
        /// </summary>
        private void ParametriDelDstAperto()
        {
            var titolo = _stilista?.Form?.Text;
            var inizio = titolo?.IndexOf(" - ", StringComparison.Ordinal) ?? -1;
            if (inizio < 0 || !titolo.EndsWith(".dst", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            var file = titolo.Substring(inizio + 3) + EstensioneParametriDst;
            if (!File.Exists(file))
            {
                return;
            }
            var oggetti = SnapshotObjects(GetReadableMemberValue(Ricamo(), "Objects"));
            if (oggetti.Count == 0)
            {
                return; // il documento si sta ancora caricando
            }
            var parametri = File.ReadAllText(file, Encoding.ASCII);
            for (var i = 0; i < oggetti.Count; i++)
            {
                ImpostaDescrizione(oggetti[i], ConParametri("RG dst · " + (i + 1), parametri));
            }
            File.Delete(file);
            ProbeLog.Write("RGLink.Parametri: scritti in " + oggetti.Count + " oggetti del DST aperto (" + parametri.Length + " caratteri)");
        }
    }
}
