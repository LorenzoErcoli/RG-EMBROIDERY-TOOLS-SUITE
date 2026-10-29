using System;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Creates a recalculable fill or running path by driving Stilista's own
        /// punch state machine.
        ///
        /// Keep this method as the readable workflow. Reflection details live in
        /// CodexTab.NativePunch.Interop.cs and mouse/coordinate adaptation lives in
        /// CodexTab.NativePunch.Input.cs.
        /// </summary>
        private bool TryCreateRecalculableObjectByNativePunch(
            object fatherEmbroidery,
            object objectsCollection,
            JsonObjectSpec spec,
            TranslationPlan plan,
            string nativeExportPath,
            bool clearDocument,
            double? orientationDeg)
        {
            const string logPrefix = "CodexTab.NativePunch";
            object nativeBox = null;
            var operationStarted = false;
            var operationEnded = false;

            try
            {
                var isRunning =
                    string.Equals(
                        spec?.Type,
                        "running",
                        StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(
                        spec?.Type,
                        "travel",
                        StringComparison.OrdinalIgnoreCase);
                var minimumPointCount = isRunning ? 2 : 3;

                // Phase 1: validate the external request and acquire the active canvas.
                if (fatherEmbroidery == null ||
                    objectsCollection == null ||
                    spec == null ||
                    spec.Geometry == null ||
                    spec.Geometry.Outer == null ||
                    spec.Geometry.Outer.Count < minimumPointCount ||
                    plan == null)
                {
                    ProbeLog.Write(logPrefix + ": missing polygon input");
                    return false;
                }

                var container = _stilista != null ? _stilista.ActiveEmbroideryContainer : null;
                var embroideryContainer = container as GmiGUI.Interfaces.IEmbroideryContainer;
                nativeBox = embroideryContainer != null ? embroideryContainer.Box : null;
                if (nativeBox == null)
                {
                    ProbeLog.Write(logPrefix + ": active GMIAlphaBox missing");
                    return false;
                }

                // Phase 2: enter the same Fill/Running NewContourAMano flow used by the UI.
                ProbeLog.Write(logPrefix + ".Box: " + nativeBox.GetType().FullName);
                if (!SelectNativePunchFunction(spec.Type, logPrefix))
                {
                    ProbeLog.Write(
                        logPrefix +
                        ": native function selection failed for " +
                        spec.Type);
                    return false;
                }

                if (clearDocument)
                {
                    TryInvokeZeroArg(objectsCollection, "Clear", logPrefix + ".ClearDocument");
                    ProbeLog.Write(
                        logPrefix + ".ClearDocument.Remaining: " +
                        (TryConvertToInt(GetReadableMemberValue(objectsCollection, "Count"))?.ToString() ??
                         "<unknown>"));
                }

                var executeMethod = FindNativeContourActionMethod(nativeBox.GetType());
                if (executeMethod == null)
                {
                    ProbeLog.Write(logPrefix + ": ExecuteContourActions missing");
                    return false;
                }

                var executeParams = executeMethod.GetParameters();
                var action = Enum.Parse(executeParams[0].ParameterType, "NewContourAMano");
                var startedResult = executeMethod.Invoke(nativeBox, new[] { action, null });
                operationStarted = startedResult is bool && (bool)startedResult;
                ProbeLog.Write(logPrefix + ".ExecuteContourActions: " + startedResult);
                if (!operationStarted)
                {
                    return false;
                }

                // Stilista has now allocated its own DesignObject and empty SourcePath.
                var currentObject = InvokeZeroArgReturning(
                    nativeBox,
                    "CBMDesignObjectInUse",
                    logPrefix + ".CurrentObject");
                if (currentObject == null)
                {
                    ProbeLog.Write(logPrefix + ": DesignObjectInUse missing");
                    return false;
                }

                var sourcePath = GetReadableMemberValue(currentObject, "SourcePath");
                if (sourcePath == null)
                {
                    ProbeLog.Write(logPrefix + ": native SourcePath missing");
                    return false;
                }

                // Phase 3: feed JSON vertices through InputContornoAMano, not by
                // assigning its backing arrays. This preserves all native side effects.
                var firstOperation = FindCurrentNativeContourOperation(
                    nativeBox,
                    logPrefix + ".Operation.BeforeInput");
                if (firstOperation == null ||
                    !(isRunning
                        ? FeedNativeOpenPath(
                            nativeBox,
                            firstOperation,
                            spec.Geometry.Outer,
                            logPrefix + ".OpenPath")
                        : FeedNativeFreehandContour(
                            nativeBox,
                            firstOperation,
                            spec.Geometry.Outer,
                            logPrefix + ".Freehand")))
                {
                    ProbeLog.Write(logPrefix + ": native freehand point feed failed");
                    return false;
                }

                var nativePoints = TryReadTaggedPointArrayFromPath(sourcePath);
                ProbeLog.Write(
                    logPrefix + ".SourceInjected: points=" +
                    (nativePoints != null ? nativePoints.Length.ToString() : "<unknown>") +
                    " bounds=" + (GetReadableMemberValue(sourcePath, "Boundaries") ?? "<unknown>"));

                ApplyTranslationPlanToDesignObject(currentObject, plan, false);
                TrySetBoolMember(currentObject, "NeedRestitching", true);

                // Phase 4: confirm the source contour and the optional direction-line
                // stage. The transition InputContornoAMano -> EditRdo is native.
                if (!InvokeNativeOperationExit(
                    firstOperation,
                    true,
                    logPrefix + ".Operation.SourceExit"))
                {
                    ProbeLog.Write(logPrefix + ": source operation Exit(true) failed");
                    return false;
                }

                operationEnded = FindObjectByReference(
                    objectsCollection,
                    currentObject);
                var directionOperation = FindCurrentNativeContourOperation(
                    nativeBox,
                    logPrefix + ".Operation.AfterSourceExit");
                if (!isRunning &&
                    IsNativeDirectionOperation(directionOperation))
                {
                    sourcePath = GetReadableMemberValue(
                        currentObject,
                        "SourcePath");
                    var orientationReady = orientationDeg.HasValue &&
                                           directionOperation != null
                        ? FeedNativeDirectionLine(
                            nativeBox,
                            directionOperation,
                            spec.Geometry.Outer,
                            orientationDeg.Value,
                            logPrefix + ".DirectionInput")
                        : TryAssignFreshOrientationLine(
                            currentObject,
                            sourcePath);
                    ProbeLog.Write(
                        logPrefix + ".OrientationReady: " +
                        orientationReady);
                    if (!orientationReady)
                    {
                        return false;
                    }

                    if (directionOperation != null)
                    {
                        InvokeNativeOperationExit(
                            directionOperation,
                            true,
                            logPrefix + ".Operation.DirectionExit");
                    }

                    operationEnded = FindObjectByReference(
                        objectsCollection,
                        currentObject);
                }
                else if (!operationEnded)
                {
                    ProbeLog.Write(
                        logPrefix +
                        ": expected EditRdo operation was not found");
                    return false;
                }

                if (!operationEnded)
                {
                    var endMethod = FindMethodInHierarchy(
                        nativeBox.GetType(),
                        "EndOp",
                        new[] { typeof(bool) });
                    if (endMethod == null)
                    {
                        ProbeLog.Write(logPrefix + ": EndOp(bool) missing");
                        return false;
                    }

                    endMethod.Invoke(nativeBox, new object[] { true });
                    operationEnded = true;
                    ProbeLog.Write(logPrefix + ".EndOp.Fallback: true");
                }

                // Phase 5: apply final parameters, force native regeneration, validate,
                // then serialize only a complete object.
                var createdObject = FindObjectByReference(objectsCollection, currentObject)
                    ? currentObject
                    : TryGetLastObject(objectsCollection);
                if (createdObject == null)
                {
                    ProbeLog.Write(logPrefix + ": finalized object not found");
                    return false;
                }

                ApplyTranslationPlanToDesignObject(createdObject, plan, true);
                TrySetBoolMember(createdObject, "NeedRestitching", true);
                var recalcResult = InvokeDesignObjectRecalc(createdObject, logPrefix);
                ProbeLog.Write(logPrefix + ".RecalcResult: " + recalcResult);

                var finalizedSource = GetReadableMemberValue(createdObject, "SourcePath");
                var stitchCount = TryConvertToInt(
                    GetReadableMemberValue(createdObject, "GetTotalNumberOfStitches"));
                var boundsValid = finalizedSource != null &&
                    ValidateGeneratedStitchBounds(
                        createdObject,
                        finalizedSource,
                        4000,
                        logPrefix + ".BoundsValidation");
                var sourceFigure = GetReadableMemberValue(
                    createdObject,
                    "SourceAndEmptyAreaPaths");
                ProbeLog.Write(
                    logPrefix + ".Result: stitches=" +
                    (stitchCount?.ToString() ?? "<unknown>") +
                    " boundsValid=" + boundsValid +
                    " sourceFigure=" + (sourceFigure != null));

                var creationSucceeded =
                    boundsValid &&
                    stitchCount.GetValueOrDefault() > 0 &&
                    (isRunning || sourceFigure != null);

                if (creationSucceeded &&
                    !string.IsNullOrWhiteSpace(nativeExportPath))
                {
                    TrySerializeNativeEmbroidery(
                        fatherEmbroidery,
                        nativeExportPath,
                        logPrefix + ".NativeExport");
                }

                TryRaiseObjectsRedrawNeeded(objectsCollection);
                TryRefreshHostAfterCreate(createdObject);
                TryExportGeneratedFillReference(createdObject, "native-punch");
                return creationSucceeded;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": <error> " + DescribeException(ex));
                return false;
            }
            finally
            {
                // Never leave Stilista trapped in an unfinished interactive operation.
                if (operationStarted && !operationEnded && nativeBox != null)
                {
                    try
                    {
                        var cancelMethod = FindMethodInHierarchy(
                            nativeBox.GetType(),
                            "EndOp",
                            new[] { typeof(bool) });
                        cancelMethod?.Invoke(nativeBox, new object[] { false });
                        ProbeLog.Write(logPrefix + ".EndOp: cancelled after failure");
                    }
                    catch (Exception cancelEx)
                    {
                        ProbeLog.Write(
                            logPrefix + ".EndOp.Cancel: <error> " +
                            DescribeException(cancelEx));
                    }
                }
            }
        }
    }
}
