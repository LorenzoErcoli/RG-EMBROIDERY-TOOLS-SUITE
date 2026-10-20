using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;

namespace StilistaHostSkeleton
{
    [DataContract]
    public sealed class JsonObjectSpec
    {
        [DataMember(Name = "schema_version", EmitDefaultValue = false)]
        public string SchemaVersion { get; set; }

        [DataMember(Name = "create_new", EmitDefaultValue = false)]
        public bool CreateNew { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "id", EmitDefaultValue = false)]
        public string Id { get; set; }

        [DataMember(Name = "geometry", EmitDefaultValue = false)]
        public JsonGeometrySpec Geometry { get; set; }

        [DataMember(Name = "stitch", EmitDefaultValue = false)]
        public JsonStitchSpec Stitch { get; set; }

        [DataMember(Name = "style", EmitDefaultValue = false)]
        public JsonStyleSpec Style { get; set; }

        [DataMember(Name = "machine", EmitDefaultValue = false)]
        public JsonMachineSpec Machine { get; set; }

        [DataMember(Name = "managed_overrides_int", EmitDefaultValue = false)]
        public Dictionary<string, int> ManagedOverridesInt { get; set; }

        [DataMember(Name = "design_object", EmitDefaultValue = false)]
        public JsonDesignObjectSpec DesignObject { get; set; }

        [DataMember(Name = "orientation_deg", EmitDefaultValue = false)]
        public double? OrientationDeg { get; set; }

        [DataMember(Name = "role", EmitDefaultValue = false)]
        public string Role { get; set; }

        [DataMember(Name = "color_role", EmitDefaultValue = false)]
        public string ColorRole { get; set; }
    }

    [DataContract]
    public sealed class JsonBatchSpec
    {
        [DataMember(Name = "schema_version", EmitDefaultValue = false)]
        public string SchemaVersion { get; set; }

        [DataMember(Name = "create_new", EmitDefaultValue = false)]
        public bool CreateNew { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "id", EmitDefaultValue = false)]
        public string Id { get; set; }

        [DataMember(Name = "objects")]
        public List<JsonObjectSpec> Objects { get; set; }

        [DataMember(Name = "sequence", EmitDefaultValue = false)]
        public JsonSequenceSpec Sequence { get; set; }
    }

    [DataContract]
    public sealed class JsonSequenceSpec
    {
        [DataMember(Name = "apply_native_needle_changes", EmitDefaultValue = false)]
        public bool ApplyNativeNeedleChanges { get; set; }

        [DataMember(Name = "require_persistent_needle_changes", EmitDefaultValue = false)]
        public bool RequirePersistentNeedleChanges { get; set; }
    }

    [DataContract]
    public sealed class JsonGeometrySpec
    {
        [DataMember(Name = "kind", EmitDefaultValue = false)]
        public string Kind { get; set; }

        [DataMember(Name = "x_mm", EmitDefaultValue = false)]
        public double? XMm { get; set; }

        [DataMember(Name = "y_mm", EmitDefaultValue = false)]
        public double? YMm { get; set; }

        [DataMember(Name = "width_mm", EmitDefaultValue = false)]
        public double? WidthMm { get; set; }

        [DataMember(Name = "height_mm", EmitDefaultValue = false)]
        public double? HeightMm { get; set; }

        [DataMember(Name = "outer", EmitDefaultValue = false)]
        public List<double[]> Outer { get; set; }

        [DataMember(Name = "holes", EmitDefaultValue = false)]
        public List<List<double[]>> Holes { get; set; }
    }

    [DataContract]
    public sealed class JsonStitchSpec
    {
        [DataMember(Name = "density_pt_cm", EmitDefaultValue = false)]
        public double? DensityPtCm { get; set; }

        [DataMember(Name = "stitch_length_mm", EmitDefaultValue = false)]
        public double? StitchLengthMm { get; set; }

        [DataMember(Name = "thread_distance_um", EmitDefaultValue = false)]
        public int? ThreadDistanceUm { get; set; }

        [DataMember(Name = "min_stitch_length_mm", EmitDefaultValue = false)]
        public double? MinStitchLengthMm { get; set; }

        [DataMember(Name = "max_stitch_length_mm", EmitDefaultValue = false)]
        public double? MaxStitchLengthMm { get; set; }

        [DataMember(Name = "elongation_pct", EmitDefaultValue = false)]
        public int? ElongationPct { get; set; }

        [DataMember(Name = "shrink_level_pct", EmitDefaultValue = false)]
        public int? ShrinkLevelPct { get; set; }

        [DataMember(Name = "overlap_pct", EmitDefaultValue = false)]
        public int? OverlapPct { get; set; }

        [DataMember(Name = "satin_offset_pct", EmitDefaultValue = false)]
        public int? SatinOffsetPct { get; set; }

        [DataMember(Name = "pull_x_pct", EmitDefaultValue = false)]
        public int? PullXPct { get; set; }

        [DataMember(Name = "pull_y_pct", EmitDefaultValue = false)]
        public int? PullYPct { get; set; }

        [DataMember(Name = "underlay", EmitDefaultValue = false)]
        public JsonUnderlaySpec Underlay { get; set; }
    }

    [DataContract]
    public sealed class JsonStyleSpec
    {
        [DataMember(Name = "fill_mode", EmitDefaultValue = false)]
        public string FillMode { get; set; }

        [DataMember(Name = "stitch_type", EmitDefaultValue = false)]
        public string StitchType { get; set; }
    }

    [DataContract]
    public sealed class JsonUnderlaySpec
    {
        [DataMember(Name = "density_pt_cm", EmitDefaultValue = false)]
        public double? DensityPtCm { get; set; }

        [DataMember(Name = "edge_distance_mm", EmitDefaultValue = false)]
        public double? EdgeDistanceMm { get; set; }

        [DataMember(Name = "stitch_length_mm", EmitDefaultValue = false)]
        public double? StitchLengthMm { get; set; }

        [DataMember(Name = "border_stitch_length_mm", EmitDefaultValue = false)]
        public double? BorderStitchLengthMm { get; set; }
    }

    [DataContract]
    public sealed class JsonMachineSpec
    {
        [DataMember(Name = "target", EmitDefaultValue = false)]
        public string Target { get; set; }

        [DataMember(Name = "needle", EmitDefaultValue = false)]
        public int? Needle { get; set; }

        [DataMember(Name = "thread_color", EmitDefaultValue = false)]
        public string ThreadColor { get; set; }
    }

    [DataContract]
    public sealed class JsonDesignObjectSpec
    {
        [DataMember(Name = "function_param_index", EmitDefaultValue = false)]
        public int? FunctionParamIndex { get; set; }
    }

    public sealed class TranslationPlan
    {
        public bool CreateNew { get; set; }
        public string ObjectType { get; set; }
        public Dictionary<string, int> ManagedIntParameters { get; private set; }
        public Dictionary<string, int> DesignObjectIntProperties { get; private set; }
        public List<string> Notes { get; private set; }

        public TranslationPlan()
        {
            ManagedIntParameters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            DesignObjectIntProperties = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            Notes = new List<string>();
        }
    }

    public static class JsonBridge
    {
        public static JsonObjectSpec LoadFromFile(string path)
        {
            using (var stream = File.OpenRead(path))
            {
                var serializer = new DataContractJsonSerializer(typeof(JsonObjectSpec));
                return serializer.ReadObject(stream) as JsonObjectSpec;
            }
        }

        public static JsonBatchSpec TryLoadBatchFromFile(string path)
        {
            try
            {
                using (var stream = File.OpenRead(path))
                {
                    var serializer = new DataContractJsonSerializer(
                        typeof(JsonBatchSpec));
                    var batch = serializer.ReadObject(stream) as JsonBatchSpec;
                    return batch != null &&
                           string.Equals(
                               batch.Type,
                               "batch",
                               StringComparison.OrdinalIgnoreCase) &&
                           batch.Objects != null &&
                           batch.Objects.Count > 0
                        ? batch
                        : null;
                }
            }
            catch
            {
                return null;
            }
        }

        public static TranslationPlan BuildPlan(JsonObjectSpec spec)
        {
            if (spec == null)
            {
                throw new ArgumentNullException("spec");
            }

            if (string.Equals(spec.Type, "fill", StringComparison.OrdinalIgnoreCase))
            {
                return BuildFillPlan(spec);
            }

            if (string.Equals(spec.Type, "running", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(spec.Type, "travel", StringComparison.OrdinalIgnoreCase))
            {
                return BuildRunningPlan(spec);
            }

            throw new InvalidOperationException("Unsupported object type: " + (spec.Type ?? "<null>"));
        }

        private static TranslationPlan BuildRunningPlan(JsonObjectSpec spec)
        {
            var plan = new TranslationPlan
            {
                CreateNew = spec.CreateNew,
                ObjectType = "running"
            };

            if (spec.Stitch != null && spec.Stitch.StitchLengthMm.HasValue)
            {
                var stitchLengthMicrons = MillimetersToMicrons(
                    spec.Stitch.StitchLengthMm.Value);
                plan.ManagedIntParameters["PISngLunghezzaPunto"] =
                    stitchLengthMicrons;
                plan.Notes.Add(
                    "running.stitch_length_mm -> PISngLunghezzaPunto = " +
                    stitchLengthMicrons);
            }

            if (spec.Machine != null && spec.Machine.Needle.HasValue)
            {
                plan.ManagedIntParameters["PINeedle"] =
                    spec.Machine.Needle.Value;
                plan.Notes.Add(
                    "machine.needle -> PINeedle = " +
                    spec.Machine.Needle.Value);
            }

            if (spec.DesignObject != null &&
                spec.DesignObject.FunctionParamIndex.HasValue)
            {
                plan.DesignObjectIntProperties["FunctionParamIndex"] =
                    spec.DesignObject.FunctionParamIndex.Value;
            }

            return plan;
        }

        private static TranslationPlan BuildFillPlan(JsonObjectSpec spec)
        {
            var plan = new TranslationPlan
            {
                CreateNew = spec.CreateNew,
                ObjectType = "fill"
            };

            if (spec.CreateNew)
            {
                plan.Notes.Add("create_new = true");
            }

            if (spec.Geometry != null && !string.IsNullOrWhiteSpace(spec.Geometry.Kind))
            {
                plan.Notes.Add("geometry.kind = " + spec.Geometry.Kind);
            }

            if (spec.DesignObject != null && spec.DesignObject.FunctionParamIndex.HasValue)
            {
                plan.DesignObjectIntProperties["FunctionParamIndex"] = spec.DesignObject.FunctionParamIndex.Value;
                plan.Notes.Add("design_object.function_param_index -> FunctionParamIndex = " + spec.DesignObject.FunctionParamIndex.Value);
            }

            if (spec.Stitch != null)
            {
                if (spec.Stitch.ThreadDistanceUm.HasValue)
                {
                    plan.ManagedIntParameters["PIThreadDistance"] = spec.Stitch.ThreadDistanceUm.Value;
                    plan.Notes.Add("thread_distance_um -> PIThreadDistance = " + spec.Stitch.ThreadDistanceUm.Value);
                }
                else if (spec.Stitch.DensityPtCm.HasValue)
                {
                    var distance = DensityPtCmToThreadDistance(spec.Stitch.DensityPtCm.Value);
                    plan.ManagedIntParameters["PIThreadDistance"] = distance;
                    plan.Notes.Add("density_pt_cm -> PIThreadDistance = " + distance);
                }

                if (spec.Stitch.StitchLengthMm.HasValue)
                {
                    var stitchLengthMicrons = MillimetersToMicrons(spec.Stitch.StitchLengthMm.Value);
                    plan.ManagedIntParameters["PISngLunghezzaPunto"] = stitchLengthMicrons;
                    plan.Notes.Add("stitch_length_mm -> PISngLunghezzaPunto = " + stitchLengthMicrons);
                }

                if (spec.Stitch.MinStitchLengthMm.HasValue)
                {
                    var minMicrons = MillimetersToMicrons(spec.Stitch.MinStitchLengthMm.Value);
                    plan.ManagedIntParameters["PIFillMinStitchLength"] = minMicrons;
                    plan.Notes.Add("min_stitch_length_mm -> PIFillMinStitchLength = " + minMicrons + " (experimental)");
                }

                if (spec.Stitch.MaxStitchLengthMm.HasValue)
                {
                    var maxMicrons = MillimetersToMicrons(spec.Stitch.MaxStitchLengthMm.Value);
                    plan.ManagedIntParameters["PIMaxMachineStitch_lenght"] = maxMicrons;
                    plan.Notes.Add("max_stitch_length_mm -> PIMaxMachineStitch_lenght = " + maxMicrons + " (experimental)");
                }

                if (spec.Stitch.ElongationPct.HasValue)
                {
                    plan.ManagedIntParameters["PIAllungamentoPunto"] = spec.Stitch.ElongationPct.Value;
                    plan.Notes.Add("elongation_pct -> PIAllungamentoPunto = " + spec.Stitch.ElongationPct.Value + " (experimental)");
                }

                if (spec.Stitch.ShrinkLevelPct.HasValue)
                {
                    plan.ManagedIntParameters["PILivelloRitiroPunti"] = spec.Stitch.ShrinkLevelPct.Value;
                    plan.Notes.Add("shrink_level_pct -> PILivelloRitiroPunti = " + spec.Stitch.ShrinkLevelPct.Value + " (experimental)");
                }

                if (spec.Stitch.OverlapPct.HasValue)
                {
                    plan.ManagedIntParameters["PISormonto"] = spec.Stitch.OverlapPct.Value;
                    plan.Notes.Add("overlap_pct -> PISormonto = " + spec.Stitch.OverlapPct.Value + " (experimental)");
                }

                if (spec.Stitch.SatinOffsetPct.HasValue)
                {
                    plan.ManagedIntParameters["PISngSfasamentoPuntoRaso"] = spec.Stitch.SatinOffsetPct.Value;
                    plan.Notes.Add("satin_offset_pct -> PISngSfasamentoPuntoRaso = " + spec.Stitch.SatinOffsetPct.Value + " (experimental)");
                }

                if (spec.Stitch.PullXPct.HasValue)
                {
                    plan.ManagedIntParameters["PIPullX"] = spec.Stitch.PullXPct.Value;
                    plan.Notes.Add("pull_x_pct -> PIPullX = " + spec.Stitch.PullXPct.Value + " (experimental)");
                }

                if (spec.Stitch.PullYPct.HasValue)
                {
                    plan.ManagedIntParameters["PIPullY"] = spec.Stitch.PullYPct.Value;
                    plan.Notes.Add("pull_y_pct -> PIPullY = " + spec.Stitch.PullYPct.Value + " (experimental)");
                }

                if (spec.Stitch.Underlay != null)
                {
                    if (spec.Stitch.Underlay.DensityPtCm.HasValue)
                    {
                        var underlayDensity = (int)Math.Round(spec.Stitch.Underlay.DensityPtCm.Value, MidpointRounding.AwayFromZero);
                        plan.ManagedIntParameters["PIDensitaImbastituraFondo"] = underlayDensity;
                        plan.Notes.Add("underlay.density_pt_cm -> PIDensitaImbastituraFondo = " + underlayDensity + " (experimental)");
                    }

                    if (spec.Stitch.Underlay.EdgeDistanceMm.HasValue)
                    {
                        var edgeDistance = MillimetersToMicrons(spec.Stitch.Underlay.EdgeDistanceMm.Value);
                        plan.ManagedIntParameters["PIDistanzaBordoImbastitureFondo"] = edgeDistance;
                        plan.Notes.Add("underlay.edge_distance_mm -> PIDistanzaBordoImbastitureFondo = " + edgeDistance + " (experimental)");
                    }

                    if (spec.Stitch.Underlay.StitchLengthMm.HasValue)
                    {
                        var underlayLength = MillimetersToMicrons(spec.Stitch.Underlay.StitchLengthMm.Value);
                        plan.ManagedIntParameters["PILunghezzaPuntoImbastituraFondo"] = underlayLength;
                        plan.Notes.Add("underlay.stitch_length_mm -> PILunghezzaPuntoImbastituraFondo = " + underlayLength + " (experimental)");
                    }

                    if (spec.Stitch.Underlay.BorderStitchLengthMm.HasValue)
                    {
                        var borderLength = MillimetersToMicrons(spec.Stitch.Underlay.BorderStitchLengthMm.Value);
                        plan.ManagedIntParameters["PILunghezzaPuntoSulBordoImbastitureFondo"] = borderLength;
                        plan.Notes.Add("underlay.border_stitch_length_mm -> PILunghezzaPuntoSulBordoImbastitureFondo = " + borderLength + " (experimental)");
                    }
                }
            }

            if (spec.Machine != null && spec.Machine.Needle.HasValue)
            {
                plan.ManagedIntParameters["PINeedle"] =
                    spec.Machine.Needle.Value;
                plan.Notes.Add(
                    "machine.needle -> PINeedle = " +
                    spec.Machine.Needle.Value);
            }

            if (spec.ManagedOverridesInt != null)
            {
                foreach (var pair in spec.ManagedOverridesInt)
                {
                    if (string.IsNullOrWhiteSpace(pair.Key))
                    {
                        continue;
                    }

                    plan.ManagedIntParameters[pair.Key] = pair.Value;
                    plan.Notes.Add("managed_overrides_int." + pair.Key + " = " + pair.Value);
                }
            }

            return plan;
        }

        public static int DensityPtCmToThreadDistance(double densityPtCm)
        {
            if (densityPtCm <= 0)
            {
                throw new ArgumentOutOfRangeException("densityPtCm");
            }

            return Math.Max(1, (int)Math.Round(10000.0 / densityPtCm, MidpointRounding.AwayFromZero));
        }

        public static int MillimetersToMicrons(double millimeters)
        {
            return (int)Math.Round(millimeters * 1000.0, MidpointRounding.AwayFromZero);
        }
    }
}
