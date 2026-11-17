using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Creates every object of a batch, or none.
        ///
        /// Since 2026-11-17 a batch read from JSON (POST /oggetti, JsonBatchSpec.ArrivatoDaJson) that fails
        /// does not just return false: the objects it created are removed from the document and an
        /// exception carries the reason. RiceviOggetti only answers ok / not ok, while the local server writes
        /// the message of an exception in "errore" ({"ok":false,"errore":"…"}): this is how the reason reaches
        /// the tool without touching Collegamento.cs. Control.Invoke rethrows the same exception (measured with
        /// a net48 form: InvalidOperationException, same message), so it must have no inner exception.
        /// A batch built in code (the fallback linear object of the return path) keeps returning false.
        /// </summary>
        private bool TryCreateRecalculableBatch(
            object fatherEmbroidery,
            object objectsCollection,
            JsonBatchSpec batch,
            string nativeExportPath)
        {
            const string logPrefix = "CodexTab.BatchImport";
            var creati = new List<object>();
            string motivo;
            bool ok;
            try
            {
                ok = CreaBatch(fatherEmbroidery, objectsCollection, batch, nativeExportPath, creati, out motivo);
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": <error> " + DescribeException(ex));
                ok = false;
                motivo = "errore dentro Stilista: " + DescribeException(ex);
            }

            if (ok)
            {
                return true;
            }

            ProbeLog.Write(logPrefix + ".Motivo: " + motivo);
            if (batch == null || !batch.ArrivatoDaJson)
            {
                return false;
            }

            var restano = TogliOggettiCreati(objectsCollection, creati, logPrefix + ".Togli");
            throw new InvalidOperationException(
                "/oggetti non ha creato niente: " + motivo + ". " +
                (creati.Count == 0
                    ? "Il documento non è cambiato."
                    : restano == 0
                        ? "Gli oggetti fatti da questa richiesta (" + creati.Count + ") sono stati tolti dal documento."
                        : "Non si sono potuti togliere " + restano + " oggetti fatti da questa richiesta: sono in fondo al documento."));
        }

        /// <summary>Removes the objects this request created; returns how many are still in the document.</summary>
        private static int TogliOggettiCreati(object objectsCollection, List<object> creati, string logPrefix)
        {
            var restano = 0;
            foreach (var oggetto in creati)
            {
                try
                {
                    if (!FindObjectByReference(objectsCollection, oggetto))
                    {
                        continue;
                    }
                    var togli = FindMethodInHierarchy(objectsCollection.GetType(), "Remove", new[] { oggetto.GetType() });
                    togli?.Invoke(objectsCollection, new[] { oggetto });
                    if (FindObjectByReference(objectsCollection, oggetto))
                    {
                        restano++;
                    }
                }
                catch (Exception ex)
                {
                    ProbeLog.Write(logPrefix + ": " + DescribeException(ex));
                    restano++;
                }
            }
            TryRaiseObjectsRedrawNeeded(objectsCollection);
            ProbeLog.Write(logPrefix + ": creati=" + creati.Count + " restano=" + restano);
            return restano;
        }

        /// <summary>«oggetto 3 di 5 («id»)»: how the reasons name an object.</summary>
        private static string QualeOggetto(JsonBatchSpec batch, int index)
        {
            var id = batch.Objects[index]?.Id;
            return "oggetto " + (index + 1) + " di " + batch.Objects.Count +
                   (string.IsNullOrWhiteSpace(id) ? "" : " («" + id + "»)");
        }

        private bool CreaBatch(
            object fatherEmbroidery,
            object objectsCollection,
            JsonBatchSpec batch,
            string nativeExportPath,
            List<object> creati,
            out string motivo)
        {
            const string logPrefix = "CodexTab.BatchImport";
            motivo = null;

            if (fatherEmbroidery == null ||
                objectsCollection == null ||
                batch == null ||
                batch.Objects == null ||
                batch.Objects.Count == 0)
            {
                ProbeLog.Write(logPrefix + ": missing batch input");
                motivo = fatherEmbroidery == null || objectsCollection == null
                    ? "nessun documento aperto in questa finestra di Stilista"
                    : "il programma non ha oggetti";
                return false;
            }

            // Phase 1: every object is checked before the first one is created.
            var plans = new List<TranslationPlan>();
            for (var index = 0; index < batch.Objects.Count; index++)
            {
                var problema = ControllaOggetto(batch.Objects[index]);
                TranslationPlan plan = null;
                if (problema == null)
                {
                    try
                    {
                        batch.Objects[index].CreateNew = true;
                        plan = JsonBridge.BuildPlan(batch.Objects[index]);
                    }
                    catch (Exception ex)
                    {
                        problema = ex.Message;
                    }
                }
                if (problema != null)
                {
                    ProbeLog.Write(logPrefix + ".Object[" + index + "]: invalid object specification: " + problema);
                    motivo = QualeOggetto(batch, index) + ": " + problema;
                    return false;
                }
                plans.Add(plan);
            }

            if (string.Equals(
                Environment.GetEnvironmentVariable(
                    "STILISTA_BRIDGE_CLEAR_DOCUMENT"),
                "1",
                StringComparison.Ordinal))
            {
                TryInvokeZeroArg(
                    objectsCollection,
                    "Clear",
                    logPrefix + ".ClearDocument");
            }

            var initialCount = TryConvertToInt(
                GetReadableMemberValue(objectsCollection, "Count"))
                .GetValueOrDefault();
            var prima = new HashSet<object>(SnapshotObjects(objectsCollection), new PerRiferimento());

            // Phase 2: native creation, one by one.
            for (var index = 0; index < batch.Objects.Count; index++)
            {
                var spec = batch.Objects[index];
                ProbeLog.Write(
                    logPrefix + ".Object[" + index + "].Start: id=" +
                    (spec.Id ?? "<null>") +
                    " role=" + (spec.Role ?? "<null>") +
                    " orientation=" +
                    (spec.OrientationDeg?.ToString() ?? "<default>"));

                string problema;
                var created = TryCreateRecalculableObjectByNativePunch(
                    fatherEmbroidery,
                    objectsCollection,
                    spec,
                    plans[index],
                    null,
                    false,
                    spec.OrientationDeg,
                    out problema);
                // whatever the outcome, what entered the document now belongs to this request
                foreach (var nuovo in SnapshotObjects(objectsCollection))
                {
                    if (!prima.Contains(nuovo) && !creati.Any(c => ReferenceEquals(c, nuovo)))
                    {
                        creati.Add(nuovo);
                    }
                }
                if (!created)
                {
                    ProbeLog.Write(
                        logPrefix + ".Object[" + index + "]: FAILED");
                    motivo = QualeOggetto(batch, index) + ": " + (problema ?? "creazione non riuscita");
                    return false;
                }

                ProbeLog.Write(
                    logPrefix + ".Object[" + index + "]: completed");
            }

            var finalCount = TryConvertToInt(
                GetReadableMemberValue(objectsCollection, "Count"))
                .GetValueOrDefault();
            var expectedCount = initialCount + batch.Objects.Count;
            var totalStitches = CountStitches(objectsCollection);
            ProbeLog.Write(
                logPrefix + ".Result: requested=" + batch.Objects.Count +
                " created=" + creati.Count +
                " initialCount=" + initialCount +
                " finalCount=" + finalCount +
                " totalStitches=" + totalStitches);

            if (finalCount != expectedCount || creati.Count != batch.Objects.Count)
            {
                motivo = "nel documento ci sono " + finalCount + " oggetti invece di " + expectedCount +
                         " (qualcuno ha cambiato il documento mentre lavoravo?)";
                return false;
            }

            // Phase 3: parameters again and a full recalculation of each object.
            if (!FinalizeBatchObjects(
                objectsCollection,
                initialCount,
                batch,
                logPrefix + ".PostPass",
                out motivo))
            {
                return false;
            }

            // Phase 4: the needle of every object that asks for one.
            if (!ApplyBatchNeedleSequence(
                fatherEmbroidery,
                objectsCollection,
                initialCount,
                batch,
                logPrefix + ".Sequence",
                out motivo))
            {
                return false;
            }

            // Phase 5: every parameter as it was asked.
            motivo = VerificaParametri(objectsCollection, initialCount, batch, plans, logPrefix + ".Verifica");
            if (motivo != null)
            {
                return false;
            }

            totalStitches = CountStitches(objectsCollection);
            ProbeLog.Write(
                logPrefix + ".PostPass.TotalStitches: " +
                totalStitches);

            if (!string.IsNullOrWhiteSpace(nativeExportPath) &&
                !TrySerializeNativeEmbroidery(
                    fatherEmbroidery,
                    nativeExportPath,
                    logPrefix + ".NativeExport"))
            {
                motivo = "il documento non si è potuto salvare in " + nativeExportPath;
                return false;
            }

            TryRaiseObjectsRedrawNeeded(objectsCollection);
            return true;
        }

        /// <summary>What is wrong with an object before anything is created, or null.</summary>
        private static string ControllaOggetto(JsonObjectSpec spec)
        {
            if (spec == null)
            {
                return "oggetto vuoto";
            }
            var isFill = string.Equals(spec.Type, "fill", StringComparison.OrdinalIgnoreCase);
            var isRunning =
                string.Equals(spec.Type, "running", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(spec.Type, "travel", StringComparison.OrdinalIgnoreCase);
            if (!isFill && !isRunning)
            {
                return "type «" + (spec.Type ?? "") + "» non si sa fare: solo fill, running o travel";
            }
            if (spec.Geometry == null || spec.Geometry.Outer == null || spec.Geometry.Outer.Count < (isRunning ? 2 : 3))
            {
                return "geometry.outer vuole almeno " + (isRunning ? 2 : 3) + " punti";
            }
            if (spec.Geometry.Holes != null && spec.Geometry.Holes.Any(h => h != null && h.Count > 0))
            {
                return "geometry.holes non si sa ancora applicare: i fori resterebbero pieni";
            }
            if (spec.Machine != null && spec.Machine.Needle.HasValue && spec.Machine.Needle.Value < 1)
            {
                return "machine.needle va da 1 (è " + spec.Machine.Needle.Value + ")";
            }
            if (spec.Machine != null && !string.IsNullOrWhiteSpace(spec.Machine.ThreadColor))
            {
                try
                {
                    ColorTranslator.FromHtml(spec.Machine.ThreadColor);
                }
                catch
                {
                    return "machine.thread_color «" + spec.Machine.ThreadColor + "» non è un colore (#RRGGBB)";
                }
            }
            return null;
        }

        private static bool FinalizeBatchObjects(
            object objectsCollection,
            int initialCount,
            JsonBatchSpec batch,
            string logPrefix,
            out string motivo)
        {
            motivo = null;
            var allObjects = SnapshotObjects(objectsCollection);
            if (initialCount < 0 ||
                allObjects.Count - initialCount != batch.Objects.Count)
            {
                ProbeLog.Write(
                    logPrefix + ": collection/order mismatch");
                motivo = "gli oggetti nuovi non sono in fondo al documento";
                return false;
            }

            for (var index = 0; index < batch.Objects.Count; index++)
            {
                var spec = batch.Objects[index];
                var designObject = allObjects[initialCount + index];
                var sourcePath = GetReadableMemberValue(
                    designObject,
                    "SourcePath");
                var orientationBefore = GetReadableMemberValue(
                    designObject,
                    "OrientationLines");
                var orientationCountBefore = TryConvertToInt(
                    GetReadableMemberValue(
                        orientationBefore,
                        "Count"))
                    .GetValueOrDefault();

                var plan = JsonBridge.BuildPlan(spec);
                ApplyTranslationPlanToDesignObject(
                    designObject,
                    plan,
                    false);
                TrySetBoolMember(
                    designObject,
                    "NeedRestitching",
                    true);
                var recalcResult = InvokeDesignObjectRecalc(
                    designObject,
                    logPrefix + ".Object[" + index + "]");
                var boundsValid =
                    sourcePath != null &&
                    ValidateGeneratedStitchBounds(
                        designObject,
                        sourcePath,
                        4000,
                        logPrefix + ".Object[" + index + "].Bounds");
                var stitchCount = TryConvertToInt(
                    GetReadableMemberValue(
                        designObject,
                        "GetTotalNumberOfStitches"))
                    .GetValueOrDefault();
                var orientationAfter = GetReadableMemberValue(
                    designObject,
                    "OrientationLines");
                var orientationCountAfter = TryConvertToInt(
                    GetReadableMemberValue(
                        orientationAfter,
                        "Count"))
                    .GetValueOrDefault();
                var orientationValid =
                    !spec.OrientationDeg.HasValue ||
                    (orientationCountBefore >= 2 &&
                     orientationCountAfter >= 2);

                ProbeLog.Write(
                    logPrefix + ".Object[" + index + "]: id=" +
                    (spec.Id ?? "<null>") +
                    " orientationBefore=" + orientationCountBefore +
                    " orientationAfter=" + orientationCountAfter +
                    " orientationValid=" + orientationValid +
                    " recalc=" + recalcResult +
                    " stitches=" + stitchCount +
                    " boundsValid=" + boundsValid);

                if (!string.Equals(recalcResult, "NoError", StringComparison.OrdinalIgnoreCase) || stitchCount <= 0)
                {
                    motivo = QualeOggetto(batch, index) + ": il ricalcolo finale di Stilista dà " + recalcResult +
                             " e " + stitchCount + " punti";
                    return false;
                }
                if (!orientationValid)
                {
                    motivo = QualeOggetto(batch, index) + ": la linea d'orientamento si è persa nel ricalcolo";
                    return false;
                }
                if (!boundsValid)
                {
                    motivo = QualeOggetto(batch, index) + ": i punti cuciti escono di più di 4 mm dal contorno";
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Every managed parameter of the plan, read back from the finished object. A name Stilista does not have,
        /// or a value it changed, is a failure with its reason: before 2026-11-17 such a value was only logged.
        /// PINeedle set from machine.needle is not checked here: the needle is checked on the object itself
        /// (ApplyBatchNeedleSequence), PINeedle is only a punch parameter.
        /// </summary>
        private static string VerificaParametri(
            object objectsCollection,
            int initialCount,
            JsonBatchSpec batch,
            List<TranslationPlan> plans,
            string logPrefix)
        {
            var objects = SnapshotObjects(objectsCollection);
            var problemi = new List<string>();
            for (var index = 0; index < batch.Objects.Count; index++)
            {
                var spec = batch.Objects[index];
                var letti = LeggiParametriInteri(objects[initialCount + index]);
                var sbagliati = new List<string>();
                foreach (var chiesto in plans[index].ManagedIntParameters)
                {
                    if (string.Equals(chiesto.Key, "PINeedle", StringComparison.OrdinalIgnoreCase) &&
                        (spec.ManagedOverridesInt == null || !spec.ManagedOverridesInt.Valori.ContainsKey("PINeedle")))
                    {
                        continue;
                    }
                    long? valore;
                    if (!letti.TryGetValue(chiesto.Key, out valore))
                    {
                        sbagliati.Add(chiesto.Key + " non c'è fra i parametri di questo oggetto");
                    }
                    else if (valore != chiesto.Value)
                    {
                        sbagliati.Add(chiesto.Key + " chiesto " + chiesto.Value + ", rimasto " +
                                      (valore.HasValue ? valore.Value.ToString(CultureInfo.InvariantCulture) : "non numerico"));
                    }
                }
                ProbeLog.Write(
                    logPrefix + ".Object[" + index + "]: requested=" + plans[index].ManagedIntParameters.Count +
                    " wrong=" + sbagliati.Count + (sbagliati.Count > 0 ? " · " + string.Join(" | ", sbagliati) : ""));
                if (sbagliati.Count > 0)
                {
                    problemi.Add(QualeOggetto(batch, index) + ": " + string.Join("; ", sbagliati));
                }
            }
            return problemi.Count == 0
                ? null
                : "parametri non applicati — " + string.Join(" · ", problemi);
        }

        /// <summary>The managed parameters of an object as integers (enums and booleans included); null for values that are not numbers.</summary>
        private static Dictionary<string, long?> LeggiParametriInteri(object designObject)
        {
            var result = new Dictionary<string, long?>(StringComparer.OrdinalIgnoreCase);
            var readOnly = GetReadableMemberValue(designObject, "Parameters");
            var writable = CreateWritableParametersClone(readOnly);
            var collection = GetReadableMemberValue(writable ?? readOnly, "ManagedParameterCollection") as IEnumerable;
            if (collection == null)
            {
                return result;
            }
            foreach (var item in collection)
            {
                var name = Convert.ToString(GetReadableMemberValue(item, "ManagedParameter"));
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }
                var value = GetReadableMemberValue(item, "Value");
                long? numero = null;
                try
                {
                    if (value is Enum || value is bool || value is IConvertible && !(value is string))
                    {
                        var d = Convert.ToDouble(value, CultureInfo.InvariantCulture);
                        if (Math.Abs(d - Math.Round(d)) < 1e-9)
                        {
                            numero = Convert.ToInt64(Math.Round(d));
                        }
                    }
                    else if (value is string && long.TryParse((string)value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                    {
                        numero = n;
                    }
                }
                catch
                {
                }
                result[name] = numero;
            }
            return result;
        }

        private static int CountStitches(object objectsCollection)
        {
            var total = 0;
            var enumerable = objectsCollection as IEnumerable;
            if (enumerable == null)
            {
                return total;
            }

            foreach (var designObject in enumerable)
            {
                total += TryConvertToInt(
                    GetReadableMemberValue(
                        designObject,
                        "GetTotalNumberOfStitches"))
                    .GetValueOrDefault();
            }

            return total;
        }
    }
}
