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
            // Stilista ricalcola l'oggetto da sé poco dopo l'inserimento (~300 ms) e la sentinella rimette i
            // punti: si misura da qui, ogni 300 ms fino a 9 s, finché tre misure di fila dicono «i nostri»
            Misura misura = null;
            var buone = 0;
            for (var i = 0; i < 30 && buone < 3; i++)
            {
                System.Threading.Thread.Sleep(300);
                misura = (Misura)NelFiloDiStilista(() => Misura_(esito, punti));
                buone = misura.Uguale ? buone + 1 : 0;
            }
            var ok = buone >= 3 && misura.OggettiOra == esito.PrimaDi + 1;
            // un oggetto rimasto senza punti non serve a niente, e se i punti sono diventati tagli laser è
            // anche pericoloso: si toglie dal documento
            var tolto = !ok && misura != null && misura.Letti == 0 && (bool)NelFiloDiStilista(() => Togli(esito));
            var sb = new StringBuilder("{\"ok\":").Append(ok ? "true" : "false");
            if (!ok)
            {
                sb.Append(",\"errore\":").Append(Json.Stringa("il ricamo non e' tornato intero: punti " + misura?.Letti + " su " + punti.Length +
                    (misura != null && misura.Laser > 0 ? " (come laser: " + misura.Laser + ")" : "") + " · " + esito.ComeManuale +
                    (tolto ? " · tolto dal documento" : "")));
            }
            sb.Append(",\"indice\":").Append(esito.Posizione);
            sb.Append(",\"tipo_prima\":").Append(Json.Stringa(esito.TipoPrima));
            sb.Append(",\"tipo_dopo\":").Append(Json.Stringa(misura?.Tipo));
            sb.Append(",\"manuale\":").Append(Json.Stringa(esito.ComeManuale));
            sb.Append(",\"punti_chiesti\":").Append(punti.Length);
            sb.Append(",\"punti_letti\":").Append(misura?.Letti ?? 0);
            sb.Append(",\"punti_cuciti\":").Append(misura?.Cuciti ?? 0);
            sb.Append(",\"salti\":").Append(misura?.Salti ?? 0);
            sb.Append(",\"punti_laser\":").Append(misura?.Laser ?? -1);
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

            // 1. l'oggetto di partenza. Di serie una COPIA dell'oggetto selezionato da cui è partito il lavoro:
            //    ha già l'ago e il colore giusti, e non serve l'interfaccia. Prima si creava un lineare
            //    «cliccando» btLinear1 nella barra di Stilista, che c'è solo se la barra mostra quella scheda
            //    (2026-10-21: «native function selection failed», e il ritorno non partiva): resta di riserva.
            //    Senza un oggetto da ricamo da copiare (2026-10-28: il documento del Pattern a macchie ha solo i 47
            //    laser delle macchie) si crea un Manual nuovo, da ricamo, come lo crea Stilista (NuovoManuale).
            object partenza = null;
            object manuale = null;
            var nelDocumento = false;
            var posizione = primaDi;
            var comeNato = "";
            if (_modelloRitorno != null && SnapshotObjects(oggetti).Contains(_modelloRitorno))
            {
                partenza = Clona(_modelloRitorno, embroidery);
                comeNato = partenza != null ? "copia dell'oggetto selezionato" : "copia non riuscita";
            }
            if (partenza == null)
            {
                manuale = NuovoManuale(embroidery);
                comeNato = manuale != null ? "manuale nuovo, da ricamo" : comeNato;
            }
            if (partenza == null && manuale == null)
            {
                partenza = LineareNativo(embroidery, oggetti, punti, ricamo);
                if (partenza == null)
                {
                    return new Ritorno { Errore = "Stilista non ha creato l'oggetto di partenza (" + (comeNato == "" ? "nessun oggetto selezionato da copiare" : comeNato) + "; log: " + ProbeLog.PathOnDisk + ")" };
                }
                nelDocumento = true;
                posizione = SnapshotObjects(oggetti).Count - 1;
                comeNato = "lineare nativo";
            }
            var nuovo = manuale != null;
            var tipoPrima = Tipo(partenza ?? manuale) + " · " + comeNato;
            var scrivi = FindMethodInHierarchy((partenza ?? manuale).GetType(), "OldPoints2StitchPath", new[] { typeof(TAGGEDPOINT[]) });
            if (scrivi == null)
            {
                return new Ritorno { Errore = "OldPoints2StitchPath non trovato su " + (partenza ?? manuale).GetType().FullName };
            }

            // 2. i punti cuciti diventano i nostri (non sempre agisce subito: si riscrivono anche dopo)
            scrivi.Invoke(partenza ?? manuale, new object[] { punti });

            // 3. un oggetto a punti manuali: una collezione con lui solo e DsgObjCollection.MergeToManualStitch()
            //    (il manuale nuovo lo è già)
            var comeManuale = "manuale nuovo";
            if (!nuovo)
            {
                try
                {
                    // la collezione del documento è una EmbroideryDsgObjCollection, senza quel costruttore:
                    // si risale alla prima classe che ha .ctor(DesignObject) (DsgObjCollection)
                    var tipoCollezione = oggetti.GetType();
                    while (tipoCollezione != null && tipoCollezione.GetConstructor(new[] { partenza.GetType() }) == null)
                    {
                        tipoCollezione = tipoCollezione.BaseType;
                    }
                    if (tipoCollezione == null)
                    {
                        throw new MissingMethodException("nessuna collezione con .ctor(" + partenza.GetType().Name + ")");
                    }
                    var collezione = Activator.CreateInstance(tipoCollezione, partenza);
                    var risultato = FindMethodInHierarchy(tipoCollezione, "MergeToManualStitch", Type.EmptyTypes)?.Invoke(collezione, null);
                    var dentro = SnapshotObjects(risultato);
                    manuale = dentro.Count == 1 ? dentro[0] : null;
                    comeManuale = "MergeToManualStitch: " + dentro.Count + " oggetti";
                }
                catch (Exception ex)
                {
                    comeManuale = "MergeToManualStitch: " + DescribeException(ex);
                }
            }
            if (manuale == null)
            {
                if (nelDocumento)
                {
                    FindMethodInHierarchy(oggetti.GetType(), "Remove", new[] { partenza.GetType() })?.Invoke(oggetti, new[] { partenza });
                }
                return new Ritorno { Errore = "MergeToManualStitch non ha dato un oggetto: " + comeManuale };
            }

            // 3b. il CONTORNO del manuale sono i nostri punti (CopyOfPoints): è la regola della sentinella —
            //     i punti cuciti di un oggetto RG Tools devono essere uguali al suo contorno — e lo segna come
            //     nostro nella descrizione, così la sentinella lo riconosce anche dopo aver riaperto il file
            var contorno = GetReadableMemberValue(manuale, "SourcePath");
            var copia = contorno?.GetType().GetProperty("CopyOfPoints");
            if (copia != null && copia.CanWrite)
            {
                copia.SetValue(contorno, punti.Clone(), null);
            }
            ImpostaDescrizione(manuale, PrefissoDescrizione + (ricamo.Nome ?? "ricamo"));
            TrySetBoolMember(manuale, "LockRecalc", true);
            TrySetBoolMember(manuale, "NeedRestitching", false);

            // 4. nel documento: al posto del lineare, o in fondo (la copia non c'era)
            var togli = FindMethodInHierarchy(oggetti.GetType(), "Remove", new[] { manuale.GetType() });
            var metti = FindMethodInHierarchy(oggetti.GetType(), "Insert", new[] { typeof(int), manuale.GetType() });
            if (metti == null || (nelDocumento && togli == null))
            {
                return new Ritorno { Errore = "Remove/Insert non trovati sulla collezione del documento" };
            }
            if (nelDocumento)
            {
                togli.Invoke(oggetti, new[] { partenza });
            }
            metti.Invoke(oggetti, new object[] { posizione, manuale });
            // L'AGO DELLO STRATO (Lorenzo, 2026-10-21: «tanti tools prevedono già la divisione in stop e aghi»):
            // il tool chiede l'ago (consecutivi da quello dell'oggetto selezionato). Si cambia solo l'ago, coi
            // colori che gli aghi hanno già nel documento: nessun colore passato = la tavolozza non si tocca.
            // Il manuale nuovo nasce sull'ago corrente di Stilista: senza ago chiesto va su quello della selezione.
            var ago = ricamo.Ago ?? (nuovo ? _agoSelezione ?? 1 : (int?)null);
            if (ago.HasValue && ReadNativeNeedleOneBased(manuale) != ago.Value)
            {
                var cambiato = TryAssignNativeNeedle(GetReadableMemberValue(embroidery, "ListaFilati"), manuale, ago.Value, null, log + ".Ago");
                comeManuale += " · ago " + ago.Value + (cambiato ? "" : " NON assegnato");
            }
            // l'inserimento lo segna da ricucire, e Stilista lo ricalcola da sé ~300 ms dopo: i punti si
            // scrivono ora che è nel documento (prima non agisce), e la sentinella fa il resto
            TrySetBoolMember(manuale, "NeedRestitching", false);
            TrySetBoolMember(manuale, "LockRecalc", true);
            scrivi.Invoke(manuale, new object[] { punti });
            AvviaSentinella();
            TryRaiseObjectsRedrawNeeded(oggetti);
            ProbeLog.Write(log + ": " + tipoPrima + " -> " + Tipo(manuale) + " punti chiesti " + punti.Length +
                " ora " + ContaPunti(manuale) + " (laser " + PuntiLaser(manuale) + ") · " + comeManuale);
            return new Ritorno
            {
                Finale = manuale,
                Inserito = true,
                Posizione = posizione,
                PrimaDi = primaDi,
                Oggetti = oggetti,
                TipoPrima = tipoPrima,
                ComeManuale = comeManuale,
            };
        }

        /// <summary>
        /// Il modello del ricamo che torna: il primo oggetto selezionato da ricamo (Parameters.isConRicamo) che non è
        /// un laser, meglio se ha già dei punti. Un laser no (2026-10-28, Pattern a macchie, 48 oggetti selezionati):
        /// nella sua copia i nostri punti diventano tagli laser — Stilista li conta in TotalLaserCoords, TotalStitches
        /// resta 0, Stitches() li dà vuoti e la sentinella li riscriveva ogni secondo per niente. Se nessuno è da
        /// ricamo, il primo che non è un laser; null se sono tutti laser.
        /// </summary>
        private static object ModelloDiRicamo(IEnumerable<object> candidati)
        {
            object senzaPunti = null;
            object diRiserva = null;
            foreach (var o in candidati)
            {
                if (Vero(o, "ContainsLaser"))
                {
                    continue;
                }
                if (Vero(GetReadableMemberValue(o, "Parameters"), "isConRicamo"))
                {
                    if (Vero(o, "ContainsStitches"))
                    {
                        return o;
                    }
                    senzaPunti = senzaPunti ?? o;
                }
                diRiserva = diRiserva ?? o;
            }
            return senzaPunti ?? diRiserva;
        }

        /// <summary>
        /// Il modello fra i selezionati, e se sono tutti laser fra gli altri oggetti del documento (2026-10-28: nel
        /// Pattern a macchie si selezionano le macchie, 46 sagome laser, e il ricamo ci va sopra). Il modello
        /// presta solo la natura di oggetto da ricamo: l'ago lo decide il tool, il colore quello dell'ago.
        /// </summary>
        private static object ModelloDiRicamo(List<object> selezionati, List<object> documento, out string dove)
        {
            var modello = ModelloDiRicamo(selezionati);
            if (modello != null)
            {
                dove = "l'oggetto " + (selezionati.IndexOf(modello) + 1) + " dei " + selezionati.Count + " selezionati";
                return modello;
            }
            modello = ModelloDiRicamo(documento.Where(o => !selezionati.Contains(o)));
            dove = modello != null
                ? "i " + selezionati.Count + " selezionati sono tutti laser: l'oggetto " + (documento.IndexOf(modello) + 1) + " del documento"
                : "nessun oggetto da ricamo, né fra i " + selezionati.Count + " selezionati né nel documento: il ritorno partirà dal lineare nativo";
            return modello;
        }

        private static bool Vero(object oggetto, string nome)
        {
            try
            {
                return GetReadableMemberValue(oggetto, nome) is bool b && b;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>I punti che Stilista conta come tagli laser (GetTotalNumberOfLaserCoords), o -1.</summary>
        private static int PuntiLaser(object oggetto)
        {
            try
            {
                return TryConvertToInt(GetReadableMemberValue(oggetto, "GetTotalNumberOfLaserCoords")) ?? -1;
            }
            catch (Exception)
            {
                return -1;
            }
        }

        /// <summary>
        /// Un oggetto Manual nuovo, da ricamo, fuori dal documento: new DesignObject(EmbDesignData, ObjectType.Manual,
        /// cTarget.Embroidery), lo stesso che Stilista usa in DsgObjCollection.MergeToManualStitch. Il costruttore gli
        /// dà l'ago corrente del documento (Objects.AddNeedle) e i parametri della funzione Manuale. Null se non riesce.
        /// </summary>
        private static object NuovoManuale(object embroidery)
        {
            try
            {
                var tipo = embroidery.GetType().Assembly.GetType("Emg2_IO.EmgDefinition+DesignObject");
                foreach (var c in tipo?.GetConstructors() ?? new System.Reflection.ConstructorInfo[0])
                {
                    var p = c.GetParameters();
                    if (p.Length == 3 && p[0].ParameterType.IsInstanceOfType(embroidery) && p[1].ParameterType.IsEnum && p[2].ParameterType.Name == "cTarget")
                    {
                        var manual = Enum.Parse(p[1].ParameterType, "Manual");
                        var daRicamo = p[2].ParameterType.GetField("Embroidery", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.GetValue(null);
                        if (daRicamo == null)
                        {
                            break;
                        }
                        return c.Invoke(new[] { embroidery, manual, daRicamo });
                    }
                }
                ProbeLog.Write("RGLink.NuovoManuale: costruttore DesignObject(EmbDesignData, ObjectType, cTarget) non trovato");
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.NuovoManuale: " + DescribeException(ex));
            }
            return null;
        }

        /// <summary>Una copia dell'oggetto (DesignObject.Clone(EmbDesignData, bool)), fuori dal documento.</summary>
        private static object Clona(object oggetto, object embroidery)
        {
            try
            {
                foreach (var m in oggetto.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                {
                    var p = m.GetParameters();
                    // Clone(EmbDesignData, bool) dichiara un IBaseObject: si tiene se è davvero un DesignObject
                    if (m.Name == "Clone" && p.Length == 2 && p[1].ParameterType == typeof(bool) && p[0].ParameterType.IsInstanceOfType(embroidery))
                    {
                        var copia = m.Invoke(oggetto, new[] { embroidery, (object)false });
                        if (copia != null && oggetto.GetType().IsInstanceOfType(copia))
                        {
                            return copia;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.Clona: " + DescribeException(ex));
            }
            return null;
        }

        /// <summary>
        /// Di riserva: un lineare nativo dal primo all'ultimo punto, col protocollo del bridge (clic su btLinear1
        /// nella barra di Stilista). Restituisce l'oggetto, già in fondo al documento, o null.
        /// </summary>
        private object LineareNativo(object embroidery, object oggetti, TAGGEDPOINT[] punti, RicamoDiRitorno ricamo)
        {
            var primaDi = SnapshotObjects(oggetti).Count;
            var primo = punti[0];
            var ultimo = punti[punti.Length - 1];
            if (primo.X == ultimo.X && primo.Y == ultimo.Y)
            {
                ultimo = punti[punti.Length / 2];
            }
            // l'ago dell'oggetto da cui e' partita la selezione, col SUO colore: il bridge scrive il colore
            // nella tavolozza del documento, e un colore diverso ricolorerebbe tutto quell'ago
            var ago = ricamo.Ago ?? _agoSelezione ?? 1;
            var colore = ricamo.Colore ?? ColoreDellAgo(embroidery, ago); // null = il colore dell'ago non si tocca
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
                return null;
            }
            var tutti = SnapshotObjects(oggetti);
            return tutti.Count == primaDi + 1 ? tutti[tutti.Count - 1] : null;
        }

        private static void ImpostaDescrizione(object oggetto, string testo)
        {
            try
            {
                var p = oggetto.GetType().GetProperty("Description");
                if (p != null && p.CanWrite && p.PropertyType == typeof(string))
                {
                    p.SetValue(oggetto, testo, null);
                }
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.Descrizione: " + ex.Message);
            }
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
            public int Laser;
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
                Laser = PuntiLaser(esito.Finale),
                ScartoUm = scarto,
                OggettiOra = SnapshotObjects(esito.Oggetti).Count,
                Tipo = Tipo(esito.Finale),
                Ago = "ago " + (ReadNativeNeedleOneBased(esito.Finale)?.ToString(CultureInfo.InvariantCulture) ?? "?") + " " + (ReadNativeThreadColor(esito.Finale) ?? "?"),
                Uguale = letti.Length == punti.Length && scarto <= 1,
            };
        }
        /// <summary>Toglie dal documento l'oggetto tornato (sul filo di Stilista). True se non c'è più.</summary>
        private static object Togli(Ritorno esito)
        {
            try
            {
                var togli = FindMethodInHierarchy(esito.Oggetti.GetType(), "Remove", new[] { esito.Finale.GetType() });
                togli?.Invoke(esito.Oggetti, new[] { esito.Finale });
                TryRaiseObjectsRedrawNeeded(esito.Oggetti);
                var via = !SnapshotObjects(esito.Oggetti).Contains(esito.Finale);
                ProbeLog.Write("RGLink.Punti: oggetto senza punti " + (via ? "tolto dal documento" : "NON tolto dal documento"));
                return via;
            }
            catch (Exception ex)
            {
                ProbeLog.Write("RGLink.Punti.Togli: " + DescribeException(ex));
                return false;
            }
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