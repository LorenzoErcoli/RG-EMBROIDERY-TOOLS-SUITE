using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using GmiGUI.Interfaces;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        private bool VerifyActiveDocument(string outputPath)
        {
            try
            {
                var container = _stilista?.ActiveEmbroideryContainer
                    as IEmbroideryContainer;
                var embroidery = container?.Box != null
                    ? GetReadableMemberValue(
                        container.Box,
                        "Embroidery")
                    : null;
                var collection = GetReadableMemberValue(
                    embroidery,
                    "Objects");
                var objects = SnapshotObjects(collection);
                if (objects.Count == 0)
                {
                    ProbeLog.Write(
                        "Verification waiting: document not loaded yet");
                    return false;
                }
                var result = new VerificationResult
                {
                    SchemaVersion = "stilista-emg-read-1",
                    SourceFile = Environment.GetEnvironmentVariable(
                        "STILISTA_BRIDGE_SOURCE_FILE"),
                    ObjectCount = objects.Count,
                    Objects = new List<VerificationObject>()
                };
                result.SourceSizeBytes = TryReadFileSize(result.SourceFile);
                result.SourceSha256 = TryReadFileSha256(result.SourceFile);
                var fullRead = string.Equals(
                    Environment.GetEnvironmentVariable(
                        "STILISTA_BRIDGE_READ_FULL"),
                    "1",
                    StringComparison.Ordinal);

                for (var index = 0; index < objects.Count; index++)
                {
                    var designObject = objects[index];
                    var item = new VerificationObject
                    {
                        Index = index,
                        Needle = ReadNativeNeedleOneBased(designObject),
                        ThreadColor = ReadNativeThreadColor(designObject),
                        SourcePointCount = TryConvertToInt(
                            GetReadableMemberValue(
                                GetReadableMemberValue(
                                    designObject,
                                    "SourcePath"),
                                "Count")).GetValueOrDefault(),
                        StitchCount = TryConvertToInt(
                            GetReadableMemberValue(
                                designObject,
                                "GetTotalNumberOfStitches"))
                            .GetValueOrDefault(),
                        StopCount = CountNativeStopsInObject(designObject)
                    };
                    if (fullRead)
                    {
                        EnrichEmgReadObject(item, designObject);
                    }
                    result.Objects.Add(item);
                }
                if (fullRead)
                {
                    result.Timeline = BuildEmgTimeline(result.Objects);
                }

                if (objects.Count > 0 &&
                    string.Equals(
                        Environment.GetEnvironmentVariable(
                            "STILISTA_BRIDGE_VERIFY_RECALC"),
                        "1",
                        StringComparison.Ordinal))
                {
                    var first = objects[0];
                    var source = GetReadableMemberValue(
                        first,
                        "SourcePath");
                    var before = TryConvertToInt(
                        GetReadableMemberValue(
                            first,
                            "GetTotalNumberOfStitches"))
                        .GetValueOrDefault();
                    TrySetBoolMember(first, "NeedRestitching", true);
                    var recalc = InvokeDesignObjectRecalc(
                        first,
                        "Verification.Recalc");
                    var after = TryConvertToInt(
                        GetReadableMemberValue(
                            first,
                            "GetTotalNumberOfStitches"))
                        .GetValueOrDefault();
                    result.Recalculation = new VerificationRecalculation
                    {
                        Result = recalc,
                        BeforeStitches = before,
                        AfterStitches = after,
                        BoundsValid = ValidateGeneratedStitchBounds(
                            first,
                            source,
                            4000,
                            "Verification.Bounds")
                    };
                }

                var fullPath = Path.GetFullPath(outputPath);
                Directory.CreateDirectory(
                    Path.GetDirectoryName(fullPath));
                using (var stream = new FileStream(
                    fullPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None))
                {
                    new DataContractJsonSerializer(
                        typeof(VerificationResult))
                        .WriteObject(stream, result);
                }
                ProbeLog.Write("Verification written: " + fullPath);
                return true;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    "Verification error: " +
                    DescribeException(ex));
                return false;
            }
        }

        private static string ReadNativeThreadColor(
            object designObject)
        {
            try
            {
                var reel = GetReadableMemberValue(
                    designObject,
                    "Reel");
                var method = FindMethodInHierarchy(
                    reel?.GetType(),
                    "getColor",
                    Type.EmptyTypes);
                var color = method?.Invoke(reel, null);
                if (color is Color)
                {
                    var value = (Color)color;
                    return "#" +
                           value.R.ToString("X2") +
                           value.G.ToString("X2") +
                           value.B.ToString("X2");
                }
            }
            catch
            {
            }
            return null;
        }
    }

    [DataContract]
    internal sealed class VerificationResult
    {
        [DataMember(Name = "schema_version")]
        public string SchemaVersion { get; set; }

        [DataMember(Name = "source_file", EmitDefaultValue = false)]
        public string SourceFile { get; set; }

        [DataMember(Name = "source_size_bytes", EmitDefaultValue = false)]
        public long? SourceSizeBytes { get; set; }

        [DataMember(Name = "source_sha256", EmitDefaultValue = false)]
        public string SourceSha256 { get; set; }

        [DataMember(Name = "object_count")]
        public int ObjectCount { get; set; }

        [DataMember(Name = "objects")]
        public List<VerificationObject> Objects { get; set; }

        [DataMember(Name = "recalculation", EmitDefaultValue = false)]
        public VerificationRecalculation Recalculation { get; set; }

        [DataMember(Name = "timeline", EmitDefaultValue = false)]
        public List<EmgTimelineEvent> Timeline { get; set; }
    }

    [DataContract]
    internal sealed class VerificationObject
    {
        [DataMember(Name = "index")]
        public int Index { get; set; }

        [DataMember(Name = "needle")]
        public int? Needle { get; set; }

        [DataMember(Name = "thread_color")]
        public string ThreadColor { get; set; }

        [DataMember(Name = "source_point_count")]
        public int SourcePointCount { get; set; }

        [DataMember(Name = "stitch_count")]
        public int StitchCount { get; set; }

        [DataMember(Name = "stop_count")]
        public int StopCount { get; set; }

        [DataMember(Name = "object_type_code", EmitDefaultValue = false)]
        public int? ObjectTypeCode { get; set; }

        [DataMember(Name = "object_type", EmitDefaultValue = false)]
        public string ObjectType { get; set; }

        [DataMember(Name = "object_type_description", EmitDefaultValue = false)]
        public string ObjectTypeDescription { get; set; }

        [DataMember(Name = "function_param_index", EmitDefaultValue = false)]
        public int? FunctionParamIndex { get; set; }

        [DataMember(Name = "source_path", EmitDefaultValue = false)]
        public EmgPathRead SourcePath { get; set; }

        [DataMember(Name = "orientation_lines", EmitDefaultValue = false)]
        public EmgPathRead OrientationLines { get; set; }

        [DataMember(Name = "stitching_path", EmitDefaultValue = false)]
        public EmgPathRead StitchingPath { get; set; }

        [DataMember(Name = "parameters", EmitDefaultValue = false)]
        public Dictionary<string, string> Parameters { get; set; }
    }

    [DataContract]
    internal sealed class VerificationRecalculation
    {
        [DataMember(Name = "result")]
        public string Result { get; set; }

        [DataMember(Name = "before_stitches")]
        public int BeforeStitches { get; set; }

        [DataMember(Name = "after_stitches")]
        public int AfterStitches { get; set; }

        [DataMember(Name = "bounds_valid")]
        public bool BoundsValid { get; set; }
    }
}
