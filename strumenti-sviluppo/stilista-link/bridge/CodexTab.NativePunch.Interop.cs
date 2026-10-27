using System;
using System.Collections;
using System.Reflection;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Selects a native Fill or Running tool. The click handler is preferred because it
        /// preserves every UI-side effect; setNewType is a compatibility fallback.
        /// </summary>
        private bool SelectNativePunchFunction(
            string objectType,
            string logPrefix)
        {
            try
            {
                var isRunning =
                    string.Equals(
                        objectType,
                        "running",
                        StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(
                        objectType,
                        "travel",
                        StringComparison.OrdinalIgnoreCase);
                var ribbon = FindHostNewObjectRibbon();
                var functionButton = GetReadableMemberValue(
                    ribbon,
                    isRunning ? "btLinear1" : "btFill1");
                if (ribbon == null || functionButton == null)
                {
                    return false;
                }

                var clickMethod = ribbon.GetType().GetMethod(
                    "btPunchToolbarEx_Click",
                    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                if (clickMethod != null)
                {
                    clickMethod.Invoke(ribbon, new[] { functionButton, null });
                    ProbeLog.Write(
                        logPrefix +
                        (isRunning ? ".SelectRunning: " : ".SelectFill: ") +
                        "btPunchToolbarEx_Click");
                    return true;
                }

                var tag = GetReadableMemberValue(functionButton, "Tag");
                var tagValue = GetReadableMemberValue(tag, "Value");
                var index = TryReadIntMember(ribbon, "fastParameterStichIndex") ??
                            TryReadIntMember(ribbon, "myFastParameterStichIndex") ??
                            0;
                var setNewType = ribbon.GetType().GetMethod(
                    "setNewType",
                    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                if (tagValue == null || setNewType == null)
                {
                    return false;
                }

                setNewType.Invoke(
                    ribbon,
                    new[] { functionButton, tagValue, (object)index });
                ProbeLog.Write(
                    logPrefix +
                    (isRunning ? ".SelectRunning: " : ".SelectFill: ") +
                    "setNewType fallback");
                return true;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix +
                    ".SelectFunction: <error> " +
                    DescribeException(ex));
                return false;
            }
        }

        private static MethodInfo FindNativeContourActionMethod(Type boxType)
        {
            if (boxType == null)
            {
                return null;
            }

            foreach (var method in boxType.GetMethods(
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance))
            {
                if (!string.Equals(
                    method.Name,
                    "ExecuteContourActions",
                    StringComparison.Ordinal))
                {
                    continue;
                }

                var parameters = method.GetParameters();
                if (parameters.Length == 2 &&
                    parameters[0].ParameterType.IsEnum)
                {
                    return method;
                }
            }

            return null;
        }

        /// <summary>
        /// Returns the current GmiContornoBox inner state (for example
        /// InputContornoAMano or EditRdo) from the controller's Gec object.
        /// </summary>
        private static object FindCurrentNativeContourOperation(
            object nativeBox,
            string logPrefix)
        {
            try
            {
                var operationController = GetMemberValueInHierarchy(nativeBox, "Gec");
                if (operationController == null)
                {
                    ProbeLog.Write(logPrefix + ": Gec missing");
                    return null;
                }

                for (var type = operationController.GetType();
                     type != null;
                     type = type.BaseType)
                {
                    foreach (var property in type.GetProperties(
                        BindingFlags.Public |
                        BindingFlags.NonPublic |
                        BindingFlags.Instance |
                        BindingFlags.DeclaredOnly))
                    {
                        if (!property.CanRead ||
                            property.GetIndexParameters().Length != 0)
                        {
                            continue;
                        }

                        object value;
                        try
                        {
                            value = property.GetValue(operationController, null);
                        }
                        catch
                        {
                            continue;
                        }

                        if (IsNativeInnerOperation(value))
                        {
                            ProbeLog.Write(
                                logPrefix + ": " + value.GetType().FullName);
                            return value;
                        }
                    }

                    foreach (var field in type.GetFields(
                        BindingFlags.Public |
                        BindingFlags.NonPublic |
                        BindingFlags.Instance |
                        BindingFlags.DeclaredOnly))
                    {
                        object value;
                        try
                        {
                            value = field.GetValue(operationController);
                        }
                        catch
                        {
                            continue;
                        }

                        if (IsNativeInnerOperation(value))
                        {
                            ProbeLog.Write(
                                logPrefix + ": " + value.GetType().FullName);
                            return value;
                        }
                    }
                }

                ProbeLog.Write(logPrefix + ": current operation missing");
                return null;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": <error> " + DescribeException(ex));
                return null;
            }
        }

        private static bool IsNativeInnerOperation(object value)
        {
            if (value == null)
            {
                return false;
            }

            var fullName = value.GetType().FullName ?? string.Empty;
            return fullName.StartsWith(
                "GmiContornoBox.ImplOperazione.",
                StringComparison.Ordinal);
        }

        private static bool IsNativeDirectionOperation(object value)
        {
            if (!IsNativeInnerOperation(value))
            {
                return false;
            }

            var fullName = value.GetType().FullName ?? string.Empty;
            return fullName.EndsWith(
                ".EditRdo",
                StringComparison.Ordinal);
        }

        private static bool InvokeNativeOperationExit(
            object operation,
            bool ok,
            string logPrefix)
        {
            try
            {
                if (operation == null)
                {
                    return false;
                }

                var method = FindMethodInHierarchy(
                    operation.GetType(),
                    "Exit",
                    new[] { typeof(bool) });
                if (method == null)
                {
                    ProbeLog.Write(logPrefix + ": Exit(bool) missing");
                    return false;
                }

                method.Invoke(operation, new object[] { ok });
                ProbeLog.Write(logPrefix + ": " + ok);
                return true;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": <error> " + DescribeException(ex));
                return false;
            }
        }

        private static object GetMemberValueInHierarchy(
            object instance,
            string memberName)
        {
            if (instance == null)
            {
                return null;
            }

            for (var type = instance.GetType(); type != null; type = type.BaseType)
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

        private static MethodInfo FindMethodInHierarchy(
            Type type,
            string methodName,
            Type[] parameterTypes)
        {
            for (var current = type; current != null; current = current.BaseType)
            {
                var method = current.GetMethod(
                    methodName,
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly,
                    null,
                    parameterTypes,
                    null);
                if (method != null)
                {
                    return method;
                }
            }

            return null;
        }

        private static object InvokeZeroArgReturning(
            object instance,
            string methodName,
            string logPrefix)
        {
            try
            {
                if (instance == null)
                {
                    return null;
                }

                var method = instance.GetType().GetMethod(
                    methodName,
                    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
                    null,
                    Type.EmptyTypes,
                    null);
                var result = method?.Invoke(instance, null);
                ProbeLog.Write(
                    logPrefix + ": " +
                    (result != null ? result.GetType().FullName : "<null>"));
                return result;
            }
            catch (Exception ex)
            {
                ProbeLog.Write(logPrefix + ": <error> " + DescribeException(ex));
                return null;
            }
        }

        private static bool FindObjectByReference(object collection, object expected)
        {
            var enumerable = collection as IEnumerable;
            if (enumerable == null || expected == null)
            {
                return false;
            }

            foreach (var item in enumerable)
            {
                if (ReferenceEquals(item, expected))
                {
                    return true;
                }
            }

            return false;
        }

        private static object TryGetLastObject(object collection)
        {
            var enumerable = collection as IEnumerable;
            if (enumerable == null)
            {
                return null;
            }

            object last = null;
            foreach (var item in enumerable)
            {
                last = item;
            }

            return last;
        }
    }
}
