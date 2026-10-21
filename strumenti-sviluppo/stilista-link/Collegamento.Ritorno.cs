using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using GMICommons.SharedTypes;

namespace StilistaHostSkeleton
{
    /// <summary>Il ricamo di un tool, come lo manda indietro: punti in mm nel riferimento dell'SVG della selezione.</summary>
    [DataContract]
    internal sealed class RicamoDiRitorno
    {
        /// <summary>Dove stava, in Stilista, lo 0,0 dell'SVG (data-rg-stilista-origine), in mm.</summary>
        [DataMember(Name = "origine_mm")] public double[] OrigineMm { get; set; }
        /// <summary>[x, y, salto]: salto = 1 se si arriva a questo punto senza cucire.</summary>
        [DataMember(Name = "punti")] public List<double[]> Punti { get; set; }
        /// <summary>Ago (da 1); assente = quello dell'oggetto selezionato da cui è partito il lavoro, o 1.</summary>
        [DataMember(Name = "ago")] public int? Ago { get; set; }
        [DataMember(Name = "colore")] public string Colore { get; set; }
        [DataMember(Name = "nome")] public string Nome { get; set; }
    }

    /// <summary>
    /// POST /punti: il ricamo torna NEL documento aperto, al suo posto, come oggetto a punti fissi.
    ///
    /// La strada (2026-10-20): un oggetto lineare nativo creato col protocollo del bridge (due punti, il
    /// primo e l'ultimo del ricamo), poi i suoi punti cuciti si sostituiscono coi nostri
    /// (DesignObject.OldPoints2StitchPath) e si blocca il ricalcolo (LockRecalc), così Stilista non lo
    /// ricalcola da sé. TAGGEDPOINT: tag 0 = punto, bit 1 (= 2) = salto, bit 15 = STOP.
    /// </summary>
    public sealed partial class CodexTab
    {
        private const int TagSalto = 1 << 1;


        private Risposta RiceviPunti(Richiesta r)
        {
            RicamoDiRitorno ricamo;
            using (var m = new MemoryStream(r.Corpo))
            {
                ricamo = new DataContractJsonSerializer(typeof(RicamoDiRitorno)).ReadObject(m) as RicamoDiRitorno;
            }
            if (ricamo?.Punti == null || ricamo.Punti.Count < 2 || ricamo.OrigineMm == null || ricamo.OrigineMm.Length < 2)
            {
                return Risposta.Testo("{\"ok\":false,\"errore\":\"servono origine_mm e almeno due punti\"}", stato: 400);
            }
            var ox = ricamo.OrigineMm[0];
            var oy = ricamo.OrigineMm[1];
            var punti = ricamo.Punti
                .Where(p => p != null && p.Length >= 2)
                .Select(p => new TAGGEDPOINT(
                    (int)Math.Round((p[0] + ox) * 1000.0),
                    (int)Math.Round((p[1] + oy) * 1000.0),
                    p.Length >= 3 && p[2] != 0 ? TagSalto : 0))
                .ToArray();

            var esito = (Ritorno)NelFiloDiStilista(() => CreaOggettoAPunti(punti, ricamo));
            if (esito.Errore != null && !esito.Inserito)
            {
                Annota("Ritorno del ricamo fallito: " + esito.Errore);
                return Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa(esito.Errore) + "}", stato: 500);
            }
            // Stilista ricalcola l'oggetto da sé poco dopo l'inserimento (~300 ms) e il guardiano rimette i
            // punti: si misura da qui, ogni 300 ms fino a 4 s, finché due misure di fila dicono «i nostri»
            Misura misura = null;
            var buone = 0;
            for (var i = 0; i < 14 && buone < 2; i++)
            {
                System.Threading.Thread.Sleep(300);
                misura = (Misura)NelFiloDiStilista(() => Misura_(esito, punti));
                buone = misura.Uguale ? buone + 1 : 0;
            }
            var ok = buone >= 2 && misura.OggettiOra == esito.PrimaDi + 1;
            var sb = new StringBuilder("{\"ok\":").Append(ok ? "true" : "false");
            if (!ok)
            {
                sb.Append(",\"errore\":").Append(Json.Stringa("il ricamo non e' tornato intero: punti " + misura?.Letti + " su " + punti.Length + " · " + esito.ComeManuale));
            }
            sb.Append(",\"indice\":").Append(esito.Posizione);
            sb.Append(",\"tipo_prima\":").Append(Json.Stringa(esito.TipoPrima));
            sb.Append(",\"tipo_dopo\":").Append(Json.Stringa(misura?.Tipo));
            sb.Append(",\"manuale\":").Append(Json.Stringa(esito.ComeManuale));
            sb.Append(",\"punti_chiesti\":").Append(punti.Length);
            sb.Append(",\"punti_letti\":").Append(misura?.Letti ?? 0);
            sb.Append(",\"punti_cuciti\":").Append(misura?.Cuciti ?? 0);
            sb.Append(",\"salti\":").Append(misura?.Salti ?? 0);
            sb.Append(",\"scarto_um\":").Append(misura == null || misura.ScartoUm == int.MaxValue ? -1 : misura.ScartoUm);
            sb.Append(",\"ago\":").Append(Json.Stringa(misura?.Ago));
            Annota(ok ? "Ricamo tornato nel documento: " + punti.Length + " punti" : "Ritorno del ricamo incompleto: vedi il log");
            return Risposta.Testo(sb.Append('}').ToString(), stato: ok ? 200 : 500);
        }

        private Ritorno CreaOggettoAPunti(TAGGEDPOINT[] punti, RicamoDiRitorno ricamo)
        {
            const string log = "RGLink.Punti";
            var embroidery = Ricamo();
            var oggetti = GetReadableMemberValue(embroidery, "Objects");
            if (embroidery == null || oggetti == null)
            {
                return new Ritorno { Errore = "nessun documento aperto" };
            }
            var primaDi = SnapshotObjects(oggetti).Count;

            // 1. un oggetto lineare nativo dal primo all'ultimo punto, ago e colore come chiesto
            var primo = punti[0];
            var ultimo = punti[punti.Length - 1];
            if (primo.X == ultimo.X && primo.Y == ultimo.Y)
            {
                ultimo = punti[punti.Length / 2];
            }
            // l'ago dell'oggetto da cui e' partita la selezione, col SUO colore: il bridge scrive il colore
            // nella tavolozza del documento, e un colore diverso ricolorerebbe tutto quell'ago
            var ago = ricamo.Ago ?? _agoSelezione ?? 1;
            var colore = ricamo.Colore ?? ColoreDellAgo(embroidery, ago) ?? "#000000";
            var batch = new JsonBatchSpec
            {
                Type = "batch",
                CreateNew = true,
                Id = ricamo.Nome ?? "rg-tools",
                Sequence = new JsonSequenceSpec { ApplyNativeNeedleChanges = true, RequirePersistentNeedleChanges = true },
                Objects = new List<JsonObjectSpec>
                {
                    new JsonObjectSpec
                    {
                        CreateNew = true,
                        Type = "running",
                        Id = ricamo.Nome ?? "rg-tools",
                        Role = "rg-tools",
                        ColorRole = "rg-tools",
                        Geometry = new JsonGeometrySpec
                        {
                            Kind = "open_path",
                            Outer = new List<double[]> { new[] { primo.X / 1000.0, primo.Y / 1000.0 }, new[] { ultimo.X / 1000.0, ultimo.Y / 1000.0 } },
                        },
                        Stitch = new JsonStitchSpec { StitchLengthMm = 3 },
                        Machine = new JsonMachineSpec { Needle = ago, ThreadColor = colore },
                    },
                },
            };
            if (!TryCreateRecalculableBatch(embroidery, oggetti, batch, null))
            {
                return new Ritorno { Errore = "Stilista non ha creato l'oggetto di partenza (log: " + ProbeLog.PathOnDisk + ")" };
            }
            var tutti = SnapshotObjects(oggetti);
            if (tutti.Count != primaDi + 1)
            {
                return new Ritorno { Errore = "oggetti " + primaDi + " -> " + tutti.Count };
            }
            var lineare = tutti[tutti.Count - 1];
            var posizione = tutti.Count - 1;
            var tipoPrima = Tipo(lineare);

            // 2. i punti cuciti diventano i nostri: OldPoints2StitchPath. L'ago e il colore li ha gia' messi il bridge.
            var scrivi = FindMethodInHierarchy(lineare.GetType(), "OldPoints2StitchPath", new[] { typeof(TAGGEDPOINT[]) });
            if (scrivi == null)
            {
                return new Ritorno { Errore = "OldPoints2StitchPath non trovato su " + lineare.GetType().FullName };
            }
            scrivi.Invoke(lineare, new object[] { punti });
            var cucitiLineare = TryConvertToInt(GetReadableMemberValue(lineare, "GetTotalNumberOfStitches")).GetValueOrDefault();

            // 3. subito, prima che Stilista lo ricalcoli dal suo contorno di due punti, diventa un oggetto a
            //    punti manuali: una collezione con lui solo e DsgObjCollection.MergeToManualStitch()
            //    (un lineare coi punti cambiati, lasciato com'e', Stilista lo ricalcola: 773 punti -> 2)
            object manuale = null;
            string comeManuale;
            try
            {
                // la collezione del documento è una EmbroideryDsgObjCollection, senza quel costruttore:
                // si risale alla prima classe che ha .ctor(DesignObject) (DsgObjCollection)
                var tipoCollezione = oggetti.GetType();
                while (tipoCollezione != null && tipoCollezione.GetConstructor(new[] { lineare.GetType() }) == null)
                {
                    tipoCollezione = tipoCollezione.BaseType;
                }
                if (tipoCollezione == null)
                {
                    throw new MissingMethodException("nessuna collezione con .ctor(" + lineare.GetType().Name + ")");
                }
                var collezione = Activator.CreateInstance(tipoCollezione, lineare);
                var unisci = FindMethodInHierarchy(tipoCollezione, "MergeToManualStitch", Type.EmptyTypes);
                var risultato = unisci?.Invoke(collezione, null);
                var dentro = SnapshotObjects(risultato);
                manuale = dentro.Count == 1 ? dentro[0] : null;
                comeManuale = "MergeToManualStitch: " + dentro.Count + " oggetti";
            }
            catch (Exception ex)
            {
                comeManuale = "MergeToManualStitch: " + DescribeException(ex);
            }
            // 3b. il manuale deve avere i NOSTRI punti, cuciti e di contorno. Sul lineare OldPoints2StitchPath
            //     non sempre li prende (corona di SH295, 26.486 punti: restavano 2, mentre i 773 delle macchie
            //     erano passati): allora si scrivono sul manuale, e il contorno si assegna (CopyOfPoints).
            if (manuale != null)
            {
                if (ContaPunti(manuale) != punti.Length)
                {
                    scrivi.Invoke(manuale, new object[] { punti });
                    comeManuale += " · punti riscritti sul manuale (" + ContaPunti(manuale) + ")";
                }
                var contorno = GetReadableMemberValue(manuale, "SourcePath");
                var copia = contorno?.GetType().GetProperty("CopyOfPoints");
                if (copia != null && copia.CanWrite && TryConvertToInt(GetReadableMemberValue(contorno, "Count")) != punti.Length)
                {
                    copia.SetValue(contorno, punti.Clone(), null);
                    comeManuale += " · contorno assegnato (" + TryConvertToInt(GetReadableMemberValue(contorno, "Count")) + ")";
                }
            }
            ProbeLog.Write(log + ": " + comeManuale);

            // 4. il manuale prende il posto del lineare, nella stessa posizione della sequenza, COL LUCCHETTO.
            //    Ogni ricalcolo di un oggetto manuale ripercorre il suo contorno (i nostri punti) con la sua
            //    lunghezza punto, e dopo l'inserimento Stilista lo ricalcola da sé: 773 punti -> 346 in pochi
            //    secondi (FunctionParamIndex 20, quello di MergeToManualStitch); con la 3 dei DST importati 251.
            //    Il DST aperto in Stilista resta intatto solo perché nessuno lo ricalcola. Quindi: lucchetto
            //    (LockRecalc, il «togliere il lucchetto?» di Stilista) e niente da ricucire, prima di inserirlo.
            var finale = lineare;
            var lucchetto = false;
            if (manuale != null)
            {
                lucchetto = TrySetBoolMember(manuale, "LockRecalc", true);
                TrySetBoolMember(manuale, "NeedRestitching", false);
                var togli = FindMethodInHierarchy(oggetti.GetType(), "Remove", new[] { lineare.GetType() });
                var metti = FindMethodInHierarchy(oggetti.GetType(), "Insert", new[] { typeof(int), lineare.GetType() });
                if (togli != null && metti != null)
                {
                    togli.Invoke(oggetti, new[] { lineare });
                    metti.Invoke(oggetti, new object[] { posizione, manuale });
                    finale = manuale;
                    // l'inserimento può averlo segnato da ricucire: di nuovo, dopo
                    TrySetBoolMember(manuale, "NeedRestitching", false);
                    TrySetBoolMember(manuale, "LockRecalc", true);
                    Sorveglia(manuale, punti, scrivi, log);
                }
                else
                {
                    comeManuale += " · Remove/Insert non trovati";
                }
            }
            if (finale == manuale)
            {
                // i punti si scrivono anche ora che è nel documento: prima di inserirlo OldPoints2StitchPath non
                // agisce (0 punti) e sul lineare non sempre; il guardiano fa il resto
                scrivi.Invoke(manuale, new object[] { punti });
                TrySetBoolMember(manuale, "NeedRestitching", false);
            }
            TryRaiseObjectsRedrawNeeded(oggetti);
            ProbeLog.Write(log + ": " + tipoPrima + " -> " + Tipo(finale) + " punti chiesti " + punti.Length +
                " lineare " + cucitiLineare + " ora " + ContaPunti(finale) + " lucchetto " + lucchetto + " · " + comeManuale);
            return new Ritorno
            {
                Finale = finale,
                Inserito = manuale != null && finale == manuale,
                Posizione = posizione,
                PrimaDi = primaDi,
                Oggetti = oggetti,
                TipoPrima = tipoPrima,
                ComeManuale = comeManuale,
                Errore = manuale == null ? "MergeToManualStitch non ha dato un oggetto: " + comeManuale : null,
            };
        }

        /// <summary>Quello che CreaOggettoAPunti ha fatto: l'oggetto da misurare finché i punti non sono i nostri.</summary>
        private sealed class Ritorno
        {
            public object Finale;
            public bool Inserito;
            public int Posizione;
            public int PrimaDi;
            public object Oggetti;
            public string TipoPrima;
            public string ComeManuale;
            public string Errore;
        }

        /// <summary>Com'è adesso l'oggetto tornato, rispetto ai punti mandati.</summary>
        private sealed class Misura
        {
            public int Letti;
            public int Cuciti;
            public int Salti;
            public int ScartoUm;
            public int OggettiOra;
            public string Tipo;
            public string Ago;
            public bool Uguale;
        }

        private static Misura Misura_(Ritorno esito, TAGGEDPOINT[] punti)
        {
            var letti = (FindMethodInHierarchy(esito.Finale.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(esito.Finale, null) as TAGGEDPOINT[]) ?? new TAGGEDPOINT[0];
            var scarto = letti.Length == punti.Length ? 0 : int.MaxValue;
            for (var i = 0; i < Math.Min(letti.Length, punti.Length) && scarto != int.MaxValue; i++)
            {
                scarto = Math.Max(scarto, Math.Max(Math.Abs(letti[i].X - punti[i].X), Math.Abs(letti[i].Y - punti[i].Y)));
            }
            return new Misura
            {
                Letti = letti.Length,
                Cuciti = TryConvertToInt(GetReadableMemberValue(esito.Finale, "GetTotalNumberOfStitches")).GetValueOrDefault(),
                Salti = letti.Count(p => (p.Tag & TagSalto) != 0),
                ScartoUm = scarto,
                OggettiOra = SnapshotObjects(esito.Oggetti).Count,
                Tipo = Tipo(esito.Finale),
                Ago = "ago " + (ReadNativeNeedleOneBased(esito.Finale)?.ToString(CultureInfo.InvariantCulture) ?? "?") + " " + (ReadNativeThreadColor(esito.Finale) ?? "?"),
                Uguale = letti.Length == punti.Length && scarto <= 1,
            };
        }
        /// <summary>
        /// Il guardiano: per 15 s, ogni 300 ms, sul filo dell'interfaccia, se Stilista ha ricalcolato l'oggetto
        /// (i punti non sono più i nostri) li riscrive. Nel log: quante volte è dovuto intervenire, e quando.
        /// </summary>
        private static void Sorveglia(object oggetto, TAGGEDPOINT[] punti, System.Reflection.MethodInfo scrivi, string log)
        {
            var leggi = FindMethodInHierarchy(oggetto.GetType(), "Stitches", Type.EmptyTypes);
            var inizio = DateTime.UtcNow;
            var interventi = 0;
            var timer = new System.Windows.Forms.Timer { Interval = 300 };
            timer.Tick += (s, e) =>
            {
                try
                {
                    var ora = (leggi?.Invoke(oggetto, null) as TAGGEDPOINT[]) ?? new TAGGEDPOINT[0];
                    var uguali = ora.Length == punti.Length && ora.Length > 0 &&
                                 ora[0].X == punti[0].X && ora[0].Y == punti[0].Y &&
                                 ora[ora.Length - 1].X == punti[punti.Length - 1].X && ora[ora.Length - 1].Y == punti[punti.Length - 1].Y;
                    if (!uguali)
                    {
                        interventi++;
                        ProbeLog.Write(log + ".Guardiano: dopo " + (int)(DateTime.UtcNow - inizio).TotalMilliseconds +
                            " ms i punti erano " + ora.Length + " su " + punti.Length + ": riscritti");
                        scrivi.Invoke(oggetto, new object[] { punti });
                        TrySetBoolMember(oggetto, "NeedRestitching", false);
                    }
                    if ((DateTime.UtcNow - inizio).TotalSeconds > 15)
                    {
                        timer.Stop();
                        timer.Dispose();
                        ProbeLog.Write(log + ".Guardiano: fine, " + interventi + " interventi");
                    }
                }
                catch (Exception ex)
                {
                    timer.Stop();
                    ProbeLog.Write(log + ".Guardiano: " + DescribeException(ex));
                }
            };
            timer.Start();
        }

        private static int ContaPunti(object oggetto)
        {
            return (FindMethodInHierarchy(oggetto.GetType(), "Stitches", Type.EmptyTypes)?.Invoke(oggetto, null) as TAGGEDPOINT[])?.Length ?? 0;
        }

        /// <summary>Il tipo di un oggetto come si riesce a leggerlo: ObjectType, o il tipo della sua funzione.</summary>
        private static string Tipo(object designObject)
        {
            ReadEmgObjectType(designObject, out var nome, out var codice);
            if (!string.IsNullOrWhiteSpace(nome))
            {
                return nome + " (" + codice + ")";
            }
            var header = GetReadableMemberValue(designObject, "Header");
            var daHeader = Convert.ToString(GetReadableMemberValue(header, "ObjectType") ?? GetReadableMemberValue(header, "Type"));
            var ricalcolatore = GetReadableMemberValue(designObject, "Ricalcolatore")?.GetType().Name;
            return (string.IsNullOrWhiteSpace(daHeader) ? "?" : daHeader) + " · " + (ricalcolatore ?? "?") +
                   " · " + Convert.ToString(GetReadableMemberValue(designObject, "Description"));
        }
        /// <summary>Il colore che l'ago ha adesso nella tavolozza del documento (#RRGGBB), o null.</summary>
        private static string ColoreDellAgo(object embroidery, int agoDaUno)
        {
            try
            {
                var lista = GetReadableMemberValue(embroidery, "ListaFilati");
                var getAgo = FindMethodInHierarchy(lista?.GetType(), "getAgo", new[] { typeof(int) });
                var ago = getAgo?.Invoke(lista, new object[] { agoDaUno - 1 });
                var colore = FindMethodInHierarchy(ago?.GetType(), "getColor", Type.EmptyTypes)?.Invoke(ago, null);
                if (colore is System.Drawing.Color c)
                {
                    return "#" + c.R.ToString("X2") + c.G.ToString("X2") + c.B.ToString("X2");
                }
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.ColoreDellAgo: " + ex.Message);
            }
            return null;
        }
    }
}