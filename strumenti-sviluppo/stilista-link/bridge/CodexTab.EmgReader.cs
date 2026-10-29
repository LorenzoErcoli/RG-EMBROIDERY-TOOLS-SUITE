using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.Serialization;
using System.Security.Cryptography;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        private static void EnrichEmgReadObject(
            VerificationObject target,
            object designObject)
        {
            string objectTypeName;
            int? objectTypeCode;
            ReadEmgObjectType(
                designObject,
                out objectTypeName,
                out objectTypeCode);
            target.ObjectType = objectTypeName;
            target.ObjectTypeCode = objectTypeCode;
            target.ObjectTypeDescription = Convert.ToString(
                GetReadableMemberValue(
                    designObject,
                    "ObjectTypeDescription"));
            target.FunctionParamIndex = TryConvertToInt(
                GetReadableMemberValue(
                    designObject,
                    "FunctionParamIndex"));
            target.SourcePath = CaptureEmgPath(
                GetReadableMemberValue(designObject, "SourcePath"));
            target.OrientationLines = CaptureEmgPath(
                GetReadableMemberValue(
                    designObject,
                    "OrientationLines"));
            target.StitchingPath = CaptureEmgPath(
                GetReadableMemberValue(
                    designObject,
                    "StitchingPath"));
            target.Parameters = CaptureManagedParameters(designObject);
        }

        private static void ReadEmgObjectType(
            object designObject,
            out string name,
            out int? code)
        {
            name = null;
            code = null;
            var direct = GetReadableMemberValue(
                designObject,
                "ObjectType");
            if (direct != null)
            {
                name = Convert.ToString(direct);
                code = TryConvertToInt(direct);
                if (!string.IsNullOrWhiteSpace(name))
                {
                    return;
                }
            }

            for (var type = designObject?.GetType();
                 type != null;
                 type = type.BaseType)
            {
                foreach (var field in type.GetFields(
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly))
                {
                    if (!field.FieldType.IsEnum ||
                        field.FieldType.FullName == null ||
                        field.FieldType.FullName.IndexOf(
                            "ObjectType",
                            StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        continue;
                    }
                    var value = field.GetValue(designObject);
                    name = Convert.ToString(value);
                    code = TryConvertToInt(value);
                    return;
                }
            }
        }

        private static EmgPathRead CaptureEmgPath(object path)
        {
            if (path == null)
            {
                return null;
            }

            var result = new EmgPathRead
            {
                RuntimeType = path.GetType().FullName,
                Points = new List<EmgPointRead>()
            };
            var bounds = ReadRectangle(
                GetReadableMemberValue(path, "Boundaries"));
            if (bounds.HasValue)
            {
                result.Bounds = new EmgBoundsRead
                {
                    MinXUm = bounds.Value.Left,
                    MinYUm = bounds.Value.Top,
                    MaxXUm = bounds.Value.Right,
                    MaxYUm = bounds.Value.Bottom,
                    WidthMm = bounds.Value.Width / 1000.0,
                    HeightMm = bounds.Value.Height / 1000.0
                };
            }

            var points = FindCoordinatePointArray(path);
            if (points != null)
            {
                foreach (var rawPoint in points)
                {
                    int x;
                    int y;
                    if (!TryReadCoordinates(rawPoint, out x, out y))
                    {
                        continue;
                    }
                    result.Points.Add(new EmgPointRead
                    {
                        XUm = x,
                        YUm = y,
                        XMm = x / 1000.0,
                        YMm = y / 1000.0
                    });
                }
            }
            result.PointCount = result.Points.Count > 0
                ? result.Points.Count
                : TryConvertToInt(
                    GetReadableMemberValue(path, "Count"))
                  .GetValueOrDefault();
            return result;
        }

        private static Array FindCoordinatePointArray(object path)
        {
            if (path == null)
            {
                return null;
            }

            var directNames = new[]
            {
                "myPoints",
                "Points",
                "GetACopyOfPoints",
                "CopyOfPoints"
            };
            foreach (var name in directNames)
            {
                var candidate = GetReadableMemberValue(path, name) as Array;
                if (LooksLikeCoordinateArray(candidate))
                {
                    return candidate;
                }
            }

            for (var type = path.GetType();
                 type != null;
                 type = type.BaseType)
            {
                foreach (var field in type.GetFields(
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly))
                {
                    var candidate = field.GetValue(path) as Array;
                    if (LooksLikeCoordinateArray(candidate))
                    {
                        return candidate;
                    }
                }
            }
            return null;
        }

        private static bool LooksLikeCoordinateArray(Array candidate)
        {
            if (candidate == null || candidate.Length == 0)
            {
                return false;
            }
            foreach (var value in candidate)
            {
                int x;
                int y;
                if (TryReadCoordinates(value, out x, out y))
                {
                    return true;
                }
            }
            return false;
        }

        private static bool TryReadCoordinates(
            object rawPoint,
            out int x,
            out int y)
        {
            x = 0;
            y = 0;
            if (rawPoint == null)
            {
                return false;
            }

            var xValue = TryConvertToInt(
                GetReadableMemberValue(rawPoint, "X"));
            var yValue = TryConvertToInt(
                GetReadableMemberValue(rawPoint, "Y"));
            if (!xValue.HasValue || !yValue.HasValue)
            {
                var nested = GetReadableMemberValue(
                    rawPoint,
                    "Point");
                xValue = TryConvertToInt(
                    GetReadableMemberValue(nested, "X"));
                yValue = TryConvertToInt(
                    GetReadableMemberValue(nested, "Y"));
            }
            if (!xValue.HasValue || !yValue.HasValue)
            {
                return false;
            }
            x = xValue.Value;
            y = yValue.Value;
            return true;
        }

        private static Dictionary<string, string>
            CaptureManagedParameters(object designObject)
        {
            var result = new Dictionary<string, string>(
                StringComparer.OrdinalIgnoreCase);
            try
            {
                var readOnly = GetReadableMemberValue(
                    designObject,
                    "Parameters");
                var writable = CreateWritableParametersClone(readOnly);
                var collection = GetReadableMemberValue(
                    writable ?? readOnly,
                    "ManagedParameterCollection") as IEnumerable;
                if (collection == null)
                {
                    return result;
                }

                foreach (var item in collection)
                {
                    var name = Convert.ToString(
                        GetReadableMemberValue(
                            item,
                            "ManagedParameter"));
                    var value = GetReadableMemberValue(item, "Value");
                    if (!string.IsNullOrWhiteSpace(name) && value != null)
                    {
                        result[name] = Convert.ToString(
                            value,
                            System.Globalization.CultureInfo.InvariantCulture);
                    }
                }
            }
            catch
            {
            }
            return result;
        }

        private static List<EmgTimelineEvent> BuildEmgTimeline(
            List<VerificationObject> objects)
        {
            var result = new List<EmgTimelineEvent>();
            int? previousNeedle = null;
            foreach (var item in objects)
            {
                if (item.Needle.HasValue &&
                    item.Needle != previousNeedle)
                {
                    result.Add(new EmgTimelineEvent
                    {
                        Kind = "needle_change",
                        Needle = item.Needle,
                        BeforeObjectIndex = item.Index
                    });
                    previousNeedle = item.Needle;
                }
                result.Add(new EmgTimelineEvent
                {
                    Kind = "object",
                    ObjectIndex = item.Index,
                    Needle = item.Needle
                });
                if (item.StopCount > 0)
                {
                    result.Add(new EmgTimelineEvent
                    {
                        Kind = "stop",
                        ObjectIndex = item.Index,
                        Count = item.StopCount
                    });
                }
            }
            return result;
        }

        private static long? TryReadFileSize(string path)
        {
            try
            {
                return !string.IsNullOrWhiteSpace(path) &&
                       File.Exists(path)
                    ? (long?)new FileInfo(path).Length
                    : null;
            }
            catch
            {
                return null;
            }
        }

        private static string TryReadFileSha256(string path)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path) ||
                    !File.Exists(path))
                {
                    return null;
                }
                using (var stream = File.OpenRead(path))
                using (var sha = SHA256.Create())
                {
                    return BitConverter
                        .ToString(sha.ComputeHash(stream))
                        .Replace("-", string.Empty)
                        .ToLowerInvariant();
                }
            }
            catch
            {
                return null;
            }
        }
    }

    [DataContract]
    internal sealed class EmgPointRead
    {
        [DataMember(Name = "x_um")]
        public int XUm { get; set; }

        [DataMember(Name = "y_um")]
        public int YUm { get; set; }

        [DataMember(Name = "x_mm")]
        public double XMm { get; set; }

        [DataMember(Name = "y_mm")]
        public double YMm { get; set; }
    }

    [DataContract]
    internal sealed class EmgBoundsRead
    {
        [DataMember(Name = "min_x_um")]
        public int MinXUm { get; set; }

        [DataMember(Name = "min_y_um")]
        public int MinYUm { get; set; }

        [DataMember(Name = "max_x_um")]
        public int MaxXUm { get; set; }

        [DataMember(Name = "max_y_um")]
        public int MaxYUm { get; set; }

        [DataMember(Name = "width_mm")]
        public double WidthMm { get; set; }

        [DataMember(Name = "height_mm")]
        public double HeightMm { get; set; }
    }

    [DataContract]
    internal sealed class EmgPathRead
    {
        [DataMember(Name = "runtime_type")]
        public string RuntimeType { get; set; }

        [DataMember(Name = "point_count")]
        public int PointCount { get; set; }

        [DataMember(Name = "points")]
        public List<EmgPointRead> Points { get; set; }

        [DataMember(Name = "bounds", EmitDefaultValue = false)]
        public EmgBoundsRead Bounds { get; set; }
    }

    [DataContract]
    internal sealed class EmgTimelineEvent
    {
        [DataMember(Name = "kind")]
        public string Kind { get; set; }

        [DataMember(Name = "object_index", EmitDefaultValue = false)]
        public int? ObjectIndex { get; set; }

        [DataMember(Name = "before_object_index", EmitDefaultValue = false)]
        public int? BeforeObjectIndex { get; set; }

        [DataMember(Name = "needle", EmitDefaultValue = false)]
        public int? Needle { get; set; }

        [DataMember(Name = "count", EmitDefaultValue = false)]
        public int? Count { get; set; }
    }
}
