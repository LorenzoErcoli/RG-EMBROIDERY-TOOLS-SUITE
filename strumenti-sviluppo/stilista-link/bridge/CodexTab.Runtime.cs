using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// Small reflection boundary around Stilista's non-public API.
    /// No embroidery rules live here.
    /// </summary>
    public sealed partial class CodexTab
    {
        private static object GetReadableMemberValue(
            object instance,
            string memberName)
        {
            if (instance == null)
            {
                return null;
            }

            for (var type = instance.GetType();
                 type != null;
                 type = type.BaseType)
            {
                var property = type.GetProperty(
                    memberName,
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly);
                if (property != null &&
                    property.CanRead &&
                    property.GetIndexParameters().Length == 0)
                {
                    return property.GetValue(instance, null);
                }

                var field = type.GetField(
                    memberName,
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly);
                if (field != null)
                {
                    return field.GetValue(instance);
                }
            }

            return null;
        }

        private static int? TryConvertToInt(object value)
        {
            try
            {
                return value == null
                    ? (int?)null
                    : Convert.ToInt32(value);
            }
            catch
            {
                return null;
            }
        }

        private static int? TryReadIntMember(
            object instance,
            string memberName)
        {
            return TryConvertToInt(
                GetReadableMemberValue(instance, memberName));
        }

        private static bool TrySetBoolMember(
            object instance,
            string memberName,
            bool value)
        {
            if (instance == null)
            {
                return false;
            }

            for (var type = instance.GetType();
                 type != null;
                 type = type.BaseType)
            {
                var property = type.GetProperty(
                    memberName,
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly);
                if (property != null &&
                    property.CanWrite &&
                    property.PropertyType == typeof(bool))
                {
                    property.SetValue(instance, value, null);
                    return true;
                }

                var field = type.GetField(
                    memberName,
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly);
                if (field != null && field.FieldType == typeof(bool))
                {
                    field.SetValue(instance, value);
                    return true;
                }
            }

            return false;
        }

        private static string InvokeDesignObjectRecalc(
            object designObject,
            string logPrefix)
        {
            try
            {
                var method = FindMethodInHierarchy(
                    designObject.GetType(),
                    "RicalcolaDiretta",
                    Type.EmptyTypes);
                var result = method?.Invoke(designObject, null);
                var text = Convert.ToString(result);
                ProbeLog.Write(logPrefix + ": " + text);
                TryInvokeZeroArg(
                    designObject,
                    "onRecalcComplete",
                    logPrefix);
                TryInvokeZeroArg(
                    designObject,
                    "RecalculateLockStitch",
                    logPrefix);
                return text;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": " + DescribeException(ex));
                return "<error>";
            }
        }

        private static void TryInvokeZeroArg(
            object instance,
            string methodName,
            string logPrefix)
        {
            try
            {
                var method = FindMethodInHierarchy(
                    instance?.GetType(),
                    methodName,
                    Type.EmptyTypes);
                var result = method?.Invoke(instance, null);
                ProbeLog.Write(
                    logPrefix + "." + methodName + ": " +
                    (result ?? "<null>"));
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + "." + methodName + ": " +
                    DescribeException(ex));
            }
        }

        private static bool ValidateGeneratedStitchBounds(
            object designObject,
            object sourcePath,
            int toleranceMicrons,
            string logPrefix)
        {
            try
            {
                var source = ReadRectangle(
                    GetReadableMemberValue(
                        sourcePath,
                        "Boundaries"));
                var stitchingPath = GetReadableMemberValue(
                    designObject,
                    "StitchingPath");
                var stitches = ReadRectangle(
                    GetReadableMemberValue(
                        stitchingPath,
                        "Boundaries"));
                if (source == null || stitches == null)
                {
                    return false;
                }

                var valid =
                    stitches.Value.Left >= source.Value.Left - toleranceMicrons &&
                    stitches.Value.Top >= source.Value.Top - toleranceMicrons &&
                    stitches.Value.Right <= source.Value.Right + toleranceMicrons &&
                    stitches.Value.Bottom <= source.Value.Bottom + toleranceMicrons;
                ProbeLog.Write(logPrefix + ": " + valid);
                return valid;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": " + DescribeException(ex));
                return false;
            }
        }

        private static Rectangle? ReadRectangle(object bounds)
        {
            if (bounds == null)
            {
                return null;
            }

            var left = TryConvertToInt(
                GetReadableMemberValue(bounds, "Left"));
            var top = TryConvertToInt(
                GetReadableMemberValue(bounds, "Top"));
            var right = TryConvertToInt(
                GetReadableMemberValue(bounds, "Right"));
            var bottom = TryConvertToInt(
                GetReadableMemberValue(bounds, "Bottom"));
            if (!left.HasValue ||
                !top.HasValue ||
                !right.HasValue ||
                !bottom.HasValue)
            {
                var x = TryConvertToInt(
                    GetReadableMemberValue(bounds, "X"));
                var y = TryConvertToInt(
                    GetReadableMemberValue(bounds, "Y"));
                var width = TryConvertToInt(
                    GetReadableMemberValue(bounds, "Width"));
                var height = TryConvertToInt(
                    GetReadableMemberValue(bounds, "Height"));
                if (x.HasValue &&
                    y.HasValue &&
                    width.HasValue &&
                    height.HasValue)
                {
                    left = x;
                    top = y;
                    right = x.Value + width.Value;
                    bottom = y.Value + height.Value;
                }
            }
            return left.HasValue &&
                   top.HasValue &&
                   right.HasValue &&
                   bottom.HasValue
                ? Rectangle.FromLTRB(
                    left.Value,
                    top.Value,
                    right.Value,
                    bottom.Value)
                : (Rectangle?)null;
        }

        private static bool TrySerializeNativeEmbroidery(
            object embroidery,
            string outputPath,
            string logPrefix)
        {
            try
            {
                var fullPath = Path.GetFullPath(outputPath);
                Directory.CreateDirectory(
                    Path.GetDirectoryName(fullPath));
                var method = embroidery.GetType().GetMethod(
                    "Serialize",
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance,
                    null,
                    new[] { typeof(Stream) },
                    null);
                if (method == null)
                {
                    return false;
                }

                using (var stream = new FileStream(
                    fullPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None))
                {
                    var result = method.Invoke(
                        embroidery,
                        new object[] { stream });
                    if (result is bool && !(bool)result)
                    {
                        return false;
                    }
                }

                var success =
                    File.Exists(fullPath) &&
                    new FileInfo(fullPath).Length > 0;
                ProbeLog.Write(
                    logPrefix + ": " + success +
                    " " + fullPath);
                return success;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": " + DescribeException(ex));
                return false;
            }
        }

        private static void TryRaiseObjectsRedrawNeeded(
            object objectsCollection)
        {
            TryInvokeZeroArg(
                objectsCollection,
                "OnObjectsRedrawNeeded",
                "Redraw");
        }

        private void TryRefreshHostAfterCreate(object designObject)
        {
            try
            {
                var container = _stilista?.ActiveEmbroideryContainer
                    as GmiGUI.Interfaces.IEmbroideryContainer;
                container?.Redraw();
            }
            catch
            {
            }
        }

        private static void TryExportGeneratedFillReference(
            object designObject,
            string stage)
        {
            // Intentionally empty in the clean runtime. Research dumps belong
            // to the original laboratory repository, not this bridge.
        }

        private static Array TryReadTaggedPointArrayFromPath(
            object pathObject)
        {
            var points = GetReadableMemberValue(
                pathObject,
                "myPoints") as Array;
            if (points != null)
            {
                return points;
            }

            foreach (var field in pathObject.GetType().GetFields(
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance))
            {
                if (field.FieldType.IsArray)
                {
                    var candidate = field.GetValue(pathObject) as Array;
                    if (candidate != null)
                    {
                        return candidate;
                    }
                }
            }

            return null;
        }

        private static bool TryAssignFreshOrientationLine(
            object designObject,
            object sourcePath)
        {
            return false;
        }

        private static List<double[]> EnsureClosedContour(
            List<double[]> contour)
        {
            var result = new List<double[]>(contour);
            var first = contour[0];
            var last = contour[contour.Count - 1];
            if (first[0] != last[0] || first[1] != last[1])
            {
                result.Add(new[] { first[0], first[1] });
            }
            return result;
        }

        private static bool TryGetJsonContourBounds(
            List<double[]> contour,
            out int minX,
            out int minY,
            out int maxX,
            out int maxY)
        {
            minX = int.MaxValue;
            minY = int.MaxValue;
            maxX = int.MinValue;
            maxY = int.MinValue;
            if (contour == null || contour.Count < 2)
            {
                return false;
            }

            foreach (var point in contour)
            {
                var x = JsonBridge.MillimetersToMicrons(point[0]);
                var y = JsonBridge.MillimetersToMicrons(point[1]);
                minX = Math.Min(minX, x);
                minY = Math.Min(minY, y);
                maxX = Math.Max(maxX, x);
                maxY = Math.Max(maxY, y);
            }
            return minX < maxX && minY < maxY;
        }

        private static object FindHostNewObjectRibbon()
        {
            foreach (Form form in Application.OpenForms)
            {
                var found = FindRibbonInControl(form);
                if (found != null)
                {
                    return found;
                }
            }
            return null;
        }

        private static object FindRibbonInControl(Control control)
        {
            if (control == null)
            {
                return null;
            }
            if (GetReadableMemberValue(control, "btFill1") != null)
            {
                return control;
            }
            foreach (Control child in control.Controls)
            {
                var found = FindRibbonInControl(child);
                if (found != null)
                {
                    return found;
                }
            }
            return null;
        }

        private static string DescribeException(Exception ex)
        {
            var parts = new List<string>();
            for (var current = ex;
                 current != null && parts.Count < 4;
                 current = current.InnerException)
            {
                parts.Add(
                    current.GetType().FullName + ": " +
                    current.Message);
            }
            return string.Join(" | INNER: ", parts.ToArray());
        }
    }
}
