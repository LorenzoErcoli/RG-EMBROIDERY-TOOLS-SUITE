using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Reflection;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Applies real Stilista needle assignments after every design object
        /// has been recalculated. This mirrors ucNeedleList.cmdCambioAgo:
        /// DesignObject.CambiaAgo(IAgo), then StitchingPath.ChangeAgo(Reel).
        /// PINeedle alone is only a punch parameter and does not build the
        /// native needle/color blocks shown by Stilista.
        /// </summary>
        private static bool ApplyBatchNeedleSequence(
            object fatherEmbroidery,
            object objectsCollection,
            int initialCount,
            JsonBatchSpec batch,
            string logPrefix)
        {
            if (batch == null || batch.Objects == null)
            {
                return false;
            }

            var objects = SnapshotObjects(objectsCollection);
            if (initialCount < 0 ||
                objects.Count - initialCount != batch.Objects.Count)
            {
                ProbeLog.Write(logPrefix + ": collection/order mismatch");
                return false;
            }

            var applyChanges = batch.Sequence != null &&
                               batch.Sequence.ApplyNativeNeedleChanges;
            var requireChanges = batch.Sequence != null &&
                                 batch.Sequence.RequirePersistentNeedleChanges;
            if (!applyChanges)
            {
                ProbeLog.Write(logPrefix + ": native needle assignment disabled");
                return !requireChanges;
            }

            var threadList = GetReadableMemberValue(
                fatherEmbroidery,
                "ListaFilati");
            if (threadList == null)
            {
                ProbeLog.Write(logPrefix + ": ListaFilati missing");
                return false;
            }

            var requested = 0;
            var applied = 0;

            for (var index = 0; index < batch.Objects.Count; index++)
            {
                var spec = batch.Objects[index];
                var needle = spec?.Machine?.Needle;
                if (!needle.HasValue || needle.Value < 1)
                {
                    ProbeLog.Write(
                        logPrefix + ".Object[" + index +
                        "]: valid one-based needle missing");
                    return !requireChanges;
                }

                requested++;
                var designObject = objects[initialCount + index];
                if (TryAssignNativeNeedle(
                    threadList,
                    designObject,
                    needle.Value,
                    spec.Machine.ThreadColor,
                    logPrefix + ".Object[" + index + "]"))
                {
                    applied++;
                }
                else if (requireChanges)
                {
                    return false;
                }
            }

            ProbeLog.Write(
                logPrefix + ": requestedNeedles=" + requested +
                " appliedNeedles=" + applied +
                " required=" + requireChanges);
            return !requireChanges || requested == applied;
        }

        private static bool TryAssignNativeNeedle(
            object threadList,
            object designObject,
            int oneBasedNeedle,
            string threadColor,
            string logPrefix)
        {
            try
            {
                var needleIndex = oneBasedNeedle - 1;
                var totalThreadsProperty = threadList.GetType().GetProperty(
                    "TotalThreads",
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance);
                if (totalThreadsProperty == null ||
                    !totalThreadsProperty.CanRead ||
                    !totalThreadsProperty.CanWrite)
                {
                    ProbeLog.Write(logPrefix + ": TotalThreads unavailable");
                    return false;
                }

                var totalThreads = Convert.ToInt32(
                    totalThreadsProperty.GetValue(threadList, null));
                if (totalThreads <= needleIndex)
                {
                    totalThreadsProperty.SetValue(
                        threadList,
                        oneBasedNeedle,
                        null);
                }

                var getNeedle = FindMethodInHierarchy(
                    threadList.GetType(),
                    "getAgo",
                    new[] { typeof(int) });
                if (getNeedle == null)
                {
                    ProbeLog.Write(logPrefix + ": getAgo(int) unavailable");
                    return false;
                }

                var needle = getNeedle.Invoke(
                    threadList,
                    new object[] { needleIndex });
                if (!TrySetNativeThreadColor(
                    needle,
                    threadColor,
                    logPrefix + ".Color"))
                {
                    return false;
                }
                var changeNeedle = FindSingleArgumentMethod(
                    designObject.GetType(),
                    "CambiaAgo",
                    needle);
                if (needle == null || changeNeedle == null)
                {
                    ProbeLog.Write(logPrefix + ": CambiaAgo unavailable");
                    return false;
                }

                changeNeedle.Invoke(designObject, new[] { needle });
                var reel = GetReadableMemberValue(designObject, "Reel");
                var stitchingPath = GetReadableMemberValue(
                    designObject,
                    "StitchingPath");
                var changePathNeedle = stitchingPath == null
                    ? null
                    : FindSingleArgumentMethod(
                        stitchingPath.GetType(),
                        "ChangeAgo",
                        reel);
                if (changePathNeedle == null)
                {
                    ProbeLog.Write(logPrefix + ": StitchingPath.ChangeAgo unavailable");
                    return false;
                }

                changePathNeedle.Invoke(stitchingPath, new[] { reel });
                var persisted = ReadNativeNeedleOneBased(designObject);
                var success = persisted == oneBasedNeedle;
                ProbeLog.Write(
                    logPrefix + ": requested=" + oneBasedNeedle +
                    " persisted=" +
                    (persisted?.ToString() ?? "<null>") +
                    " applied=" + success);
                return success;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": <error> " + DescribeException(ex));
                return false;
            }
        }

        private static bool TrySetNativeThreadColor(
            object needle,
            string colorText,
            string logPrefix)
        {
            if (needle == null || string.IsNullOrWhiteSpace(colorText))
            {
                return true;
            }

            try
            {
                var color = ColorTranslator.FromHtml(colorText);
                var getThread = FindMethodInHierarchy(
                    needle.GetType(),
                    "getFiloRO",
                    Type.EmptyTypes);
                var thread = getThread?.Invoke(needle, null);
                var colorProperty = thread?.GetType().GetProperty(
                    "Color",
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance);
                if (colorProperty == null || !colorProperty.CanWrite)
                {
                    ProbeLog.Write(logPrefix + ": writable Color unavailable");
                    return false;
                }

                colorProperty.SetValue(thread, color, null);
                var persisted = (Color)colorProperty.GetValue(thread, null);
                var success = persisted.ToArgb() == color.ToArgb();
                ProbeLog.Write(
                    logPrefix + ": requested=" + colorText +
                    " persisted=#" +
                    persisted.R.ToString("X2") +
                    persisted.G.ToString("X2") +
                    persisted.B.ToString("X2") +
                    " applied=" + success);
                return success;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": <error> " + DescribeException(ex));
                return false;
            }
        }

        private static MethodInfo FindSingleArgumentMethod(
            Type type,
            string name,
            object argument)
        {
            for (var current = type;
                 current != null;
                 current = current.BaseType)
            {
                foreach (var method in current.GetMethods(
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly))
                {
                    var parameters = method.GetParameters();
                    if (string.Equals(method.Name, name, StringComparison.Ordinal) &&
                        parameters.Length == 1 &&
                        (argument == null ||
                         parameters[0].ParameterType.IsInstanceOfType(argument)))
                    {
                        return method;
                    }
                }
            }

            return null;
        }

        private static int? ReadNativeNeedleOneBased(object designObject)
        {
            if (designObject == null)
            {
                return null;
            }

            var agoMethod = FindMethodInHierarchy(
                designObject.GetType(),
                "Ago",
                Type.EmptyTypes);
            if (agoMethod == null)
            {
                return null;
            }

            var zeroBased = TryConvertToInt(
                agoMethod.Invoke(designObject, null));
            return zeroBased.HasValue ? zeroBased.Value + 1 : (int?)null;
        }

        private static MethodInfo FindIndexedTagMethod(
            Type type,
            string name)
        {
            for (var current = type;
                 current != null;
                 current = current.BaseType)
            {
                foreach (var method in current.GetMethods(
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly))
                {
                    var parameters = method.GetParameters();
                    if (!string.Equals(
                            method.Name,
                            name,
                            StringComparison.Ordinal) ||
                        parameters.Length < 1 ||
                        parameters[0].ParameterType != typeof(int))
                    {
                        continue;
                    }

                    if (string.Equals(name, "get_Tag", StringComparison.Ordinal) &&
                        parameters.Length == 1)
                    {
                        return method;
                    }

                    if (string.Equals(name, "set_Tag", StringComparison.Ordinal) &&
                        parameters.Length == 2)
                    {
                        return method;
                    }
                }
            }

            return null;
        }

        private static List<object> SnapshotObjects(object objectsCollection)
        {
            var result = new List<object>();
            var enumerable = objectsCollection as IEnumerable;
            if (enumerable == null)
            {
                return result;
            }

            foreach (var item in enumerable)
            {
                if (item != null)
                {
                    result.Add(item);
                }
            }

            return result;
        }

        private static int CountNativeStopsInObject(object designObject)
        {
            var tags = CaptureStitchTagTypeCounts(designObject);
            int count;
            return tags.TryGetValue(
                "Emg2_IO.EmgTypes.etStop",
                out count)
                ? count
                : 0;
        }

        private static Dictionary<string, int> CaptureStitchTagTypeCounts(
            object designObject)
        {
            var result = new Dictionary<string, int>(
                StringComparer.Ordinal);
            var stitchingPath = GetReadableMemberValue(
                designObject,
                "StitchingPath");
            var points = GetReadableMemberValue(stitchingPath, "Points");
            if (points == null)
            {
                return result;
            }

            var getTag = FindIndexedTagMethod(points.GetType(), "get_Tag");
            var count = TryConvertToInt(
                GetReadableMemberValue(points, "Count")) ??
                TryConvertToInt(GetReadableMemberValue(points, "Length")) ??
                0;
            if (getTag == null)
            {
                return result;
            }

            for (var index = 0; index < count; index++)
            {
                var tag = getTag.Invoke(points, new object[] { index });
                var name = tag?.GetType().FullName ?? "<null>";
                int current;
                result.TryGetValue(name, out current);
                result[name] = current + 1;
            }

            return result;
        }

    }
}
