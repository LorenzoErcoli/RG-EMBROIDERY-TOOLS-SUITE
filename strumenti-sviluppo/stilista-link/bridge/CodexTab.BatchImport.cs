using System;
using System.Collections;
using System.Collections.Generic;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        private bool TryCreateRecalculableBatch(
            object fatherEmbroidery,
            object objectsCollection,
            JsonBatchSpec batch,
            string nativeExportPath)
        {
            const string logPrefix = "CodexTab.BatchImport";

            try
            {
                if (fatherEmbroidery == null ||
                    objectsCollection == null ||
                    batch == null ||
                    batch.Objects == null ||
                    batch.Objects.Count == 0)
                {
                    ProbeLog.Write(logPrefix + ": missing batch input");
                    return false;
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
                var createdCount = 0;

                for (var index = 0; index < batch.Objects.Count; index++)
                {
                    var spec = batch.Objects[index];
                    var isFill = string.Equals(
                        spec?.Type,
                        "fill",
                        StringComparison.OrdinalIgnoreCase);
                    var isRunning =
                        string.Equals(
                            spec?.Type,
                            "running",
                            StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(
                            spec?.Type,
                            "travel",
                            StringComparison.OrdinalIgnoreCase);
                    if (spec == null ||
                        (!isFill && !isRunning) ||
                        spec.Geometry == null ||
                        spec.Geometry.Outer == null ||
                        spec.Geometry.Outer.Count < (isRunning ? 2 : 3))
                    {
                        ProbeLog.Write(
                            logPrefix + ".Object[" + index +
                            "]: invalid object specification");
                        return false;
                    }

                    spec.CreateNew = true;
                    var plan = JsonBridge.BuildPlan(spec);
                    ProbeLog.Write(
                        logPrefix + ".Object[" + index + "].Start: id=" +
                        (spec.Id ?? "<null>") +
                        " role=" + (spec.Role ?? "<null>") +
                        " orientation=" +
                        (spec.OrientationDeg?.ToString() ?? "<default>"));

                    var created = TryCreateRecalculableObjectByNativePunch(
                        fatherEmbroidery,
                        objectsCollection,
                        spec,
                        plan,
                        null,
                        false,
                        spec.OrientationDeg);
                    if (!created)
                    {
                        ProbeLog.Write(
                            logPrefix + ".Object[" + index + "]: FAILED");
                        return false;
                    }

                    createdCount++;
                    ProbeLog.Write(
                        logPrefix + ".Object[" + index + "]: completed");
                }

                var finalCount = TryConvertToInt(
                    GetReadableMemberValue(objectsCollection, "Count"))
                    .GetValueOrDefault();
                var expectedCount = initialCount + createdCount;
                var totalStitches = CountStitches(objectsCollection);
                var countValid =
                    createdCount == batch.Objects.Count &&
                    finalCount == expectedCount;

                ProbeLog.Write(
                    logPrefix + ".Result: requested=" + batch.Objects.Count +
                    " created=" + createdCount +
                    " initialCount=" + initialCount +
                    " finalCount=" + finalCount +
                    " totalStitches=" + totalStitches +
                    " countValid=" + countValid);

                if (!countValid || totalStitches <= 0)
                {
                    return false;
                }

                if (!FinalizeBatchObjects(
                    objectsCollection,
                    initialCount,
                    batch,
                    logPrefix + ".PostPass"))
                {
                    return false;
                }

                if (!ApplyBatchNeedleSequence(
                    fatherEmbroidery,
                    objectsCollection,
                    initialCount,
                    batch,
                    logPrefix + ".Sequence"))
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
                    return false;
                }

                TryRaiseObjectsRedrawNeeded(objectsCollection);
                return true;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": <error> " +
                    DescribeException(ex));
                return false;
            }
        }

        private static bool FinalizeBatchObjects(
            object objectsCollection,
            int initialCount,
            JsonBatchSpec batch,
            string logPrefix)
        {
            var enumerable = objectsCollection as IEnumerable;
            if (enumerable == null)
            {
                return false;
            }

            var allObjects = new List<object>();
            foreach (var designObject in enumerable)
            {
                if (designObject != null)
                {
                    allObjects.Add(designObject);
                }
            }

            if (initialCount < 0 ||
                allObjects.Count - initialCount != batch.Objects.Count)
            {
                ProbeLog.Write(
                    logPrefix + ": collection/order mismatch");
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

                if (!orientationValid ||
                    !string.Equals(
                        recalcResult,
                        "NoError",
                        StringComparison.OrdinalIgnoreCase) ||
                    stitchCount <= 0 ||
                    !boundsValid)
                {
                    return false;
                }
            }

            return true;
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
