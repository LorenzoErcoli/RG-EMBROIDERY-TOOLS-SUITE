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
        /// CodexTab.NativePunch.Interop.cs, mouse/coordinate adaptation lives in
        /// CodexTab.NativePunch.Input.cs and the exact contour (2026-11-17) in
        /// CodexTab.ContornoEsatto.cs.
        ///
        /// On failure <paramref name="motivo"/> says why, in Italian, for the reply
        /// of POST /oggetti.
        /// </summary>
        private bool TryCreateRecalculableObjectByNativePunch(
            object fatherEmbroidery,
            object objectsCollection,
            JsonObjectSpec spec,
            TranslationPlan plan,
            string nativeExportPath,
            bool clearDocument,
            double? orientationDeg,
            out string motivo)
        {
            const string logPrefix = "CodexTab.NativePunch";
            motivo = null;
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
                    motivo = "mancano il contorno o il documento";
                    return false;
                }

                // The requested points, to the micron: the final contour is this one.
                var esatti = PuntiInMicron(spec.Geometry.Outer);
                if (!isRunning &&
                    esatti.Count >= 2 &&
                    esatti[0] == esatti[esatti.Count - 1])
                {
                    esatti.RemoveAt(esatti.Count - 1);
                }
                if (esatti.Count < minimumPointCount)
                {
                    motivo = "il contorno ha meno di " + minimumPointCount +
                             " punti distinti al micron";
                    return false;
                }

                var container = _stilista != null ? _stilista.ActiveEmbroideryContainer : null;
                var embroideryContainer = container as GmiGUI.Interfaces.IEmbroideryContainer;
                nativeBox = embroideryContainer != null ? embroideryContainer.Box : null;
                if (nativeBox == null)
                {
                    ProbeLog.Write(logPrefix + ": active GMIAlphaBox missing");
                    motivo = "nessun documento attivo in questa finestra di Stilista";
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
                    motivo = "Stilista non ha attivato lo strumento «" + spec.Type +
                             "» (il pulsante nella barra non si trova)";
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
                    motivo = "manca ExecuteContourActions nella finestra di Stilista";
                    return false;
                }

                var executeParams = executeMethod.GetParameters();
                var action = Enum.Parse(executeParams[0].ParameterType, "NewContourAMano");
                var startedResult = executeMethod.Invoke(nativeBox, new[] { action, null });
                operationStarted = startedResult is bool && (bool)startedResult;
                ProbeLog.Write(logPrefix + ".ExecuteContourActions: " + startedResult);
                if (!operationStarted)
                {
                    motivo = "Stilista non ha aperto il disegno a mano del contorno " +
                             "(c'è un'altra operazione in corso nella finestra?)";
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
                    motivo = "Stilista non ha creato l'oggetto nuovo";
                    return false;
                }

                var sourcePath = GetReadableMemberValue(currentObject, "SourcePath");
                if (sourcePath == null)
                {
                    ProbeLog.Write(logPrefix + ": native SourcePath missing");
                    motivo = "l'oggetto nuovo non ha un contorno (SourcePath)";
                    return false;
                }

                // Phase 3: feed JSON vertices through InputContornoAMano, not by
                // assigning its backing arrays. This preserves all native side effects.
                // What is fed is a copy of the shape, about 200 px wide, in the middle
                // of the visible canvas: InputContornoAMano works in screen pixels, so
                // the real shape would depend on the zoom. The exact points are
                // written in phase 5.
                var immessa = CopiaDaImmettere(nativeBox, esatti, logPrefix + ".Copia");
                var firstOperation = FindCurrentNativeContourOperation(
                    nativeBox,
                    logPrefix + ".Operation.BeforeInput");
                if (firstOperation == null ||
                    !(isRunning
                        ? FeedNativeOpenPath(
                            nativeBox,
                            firstOperation,
                            immessa,
                            logPrefix + ".OpenPath")
                        : FeedNativeFreehandContour(
                            nativeBox,
                            firstOperation,
                            immessa,
                            logPrefix + ".Freehand")))
                {
                    ProbeLog.Write(logPrefix + ": native freehand point feed failed");
                    motivo = "Stilista non ha preso i punti del contorno disegnato a mano";
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
                    motivo = "Stilista non ha chiuso il contorno disegnato a mano";
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
                            immessa,
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
                        motivo = orientationDeg.HasValue
                            ? "Stilista non ha preso la linea d'orientamento"
                            : "un riempimento vuole orientation_deg (la direzione del punto)";
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
                    motivo = "dopo il contorno Stilista non ha chiesto la linea d'orientamento, " +
                             "e l'oggetto non è entrato nel documento";
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
                        motivo = "l'operazione di Stilista non si chiude (EndOp manca)";
                        return false;
                    }

                    endMethod.Invoke(nativeBox, new object[] { true });
                    operationEnded = true;
                    ProbeLog.Write(logPrefix + ".EndOp.Fallback: true");
                }

                // Phase 5: exact contour and orientation, final parameters, native
                // regeneration, validation, then serialize only a complete object.
                var createdObject = FindObjectByReference(objectsCollection, currentObject)
                    ? currentObject
                    : TryGetLastObject(objectsCollection);
                if (createdObject == null)
                {
                    ProbeLog.Write(logPrefix + ": finalized object not found");
                    motivo = "l'oggetto creato non è nel documento";
                    return false;
                }

                // closed or open as Stilista made it from the mouse input
                var immessi = PuntiConTag(GetReadableMemberValue(createdObject, "SourcePath"));
                var chiusoDaStilista = immessi.Count > 2 &&
                    immessi[0][0] == immessi[immessi.Count - 1][0] &&
                    immessi[0][1] == immessi[immessi.Count - 1][1];
                string problema;
                var scritti = RiscriviContornoEsatto(
                    createdObject,
                    esatti,
                    !isRunning && chiusoDaStilista,
                    out problema);
                if (scritti == null)
                {
                    motivo = problema;
                    return false;
                }

                // the holes as empty areas of the fill, to the micron (CodexTab.ForiEsatti.cs)
                var fori = isRunning ? new System.Collections.Generic.List<System.Collections.Generic.List<System.Drawing.Point>>() : ForiInMicron(spec.Geometry);
                System.Collections.Generic.List<System.Collections.Generic.List<System.Drawing.Point>> foriScritti = null;
                if (fori.Count > 0)
                {
                    foriScritti = ScriviFori(createdObject, fori, out problema);
                    if (foriScritti == null)
                    {
                        motivo = problema;
                        return false;
                    }
                }

                if (!isRunning && orientationDeg.HasValue)
                {
                    problema = ImpostaOrientamentoEsatto(
                        createdObject,
                        esatti,
                        orientationDeg.Value);
                    if (problema != null)
                    {
                        motivo = problema;
                        return false;
                    }
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
                int puntiLetti;
                var scarto = ScartoDelContorno(createdObject, scritti, out puntiLetti);
                ProbeLog.Write(
                    logPrefix + ".Result: stitches=" +
                    (stitchCount?.ToString() ?? "<unknown>") +
                    " boundsValid=" + boundsValid +
                    " sourceFigure=" + (sourceFigure != null) +
                    " contour=" + puntiLetti + "/" + scritti.Count +
                    " deviationMm=" + scarto);

                if (stitchCount.GetValueOrDefault() <= 0)
                {
                    motivo = "il ricalcolo di Stilista non ha dato punti (" + recalcResult + ")";
                }
                else if (scarto > ScartoMassimoContornoMm)
                {
                    motivo = double.IsInfinity(scarto)
                        ? "il contorno dell'oggetto ha " + puntiLetti + " punti invece di " + scritti.Count
                        : "il contorno dell'oggetto si scosta di " + scarto.ToString("0.###") +
                          " mm dai punti chiesti";
                }
                else if (!boundsValid)
                {
                    motivo = "i punti cuciti escono di più di 4 mm dal contorno (" + recalcResult + ")";
                }
                else if (!isRunning && sourceFigure == null)
                {
                    motivo = "il riempimento non ha la sua figura (SourceAndEmptyAreaPaths)";
                }
                else if (foriScritti != null)
                {
                    motivo = VerificaFori(createdObject, foriScritti);
                    ProbeLog.Write(logPrefix + ".Fori: " + foriScritti.Count + " " + (motivo ?? "vuoti"));
                }

                var creationSucceeded = motivo == null;

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
                motivo = "errore dentro Stilista: " + DescribeException(ex);
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
