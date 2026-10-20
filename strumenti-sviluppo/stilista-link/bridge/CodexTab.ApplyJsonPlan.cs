using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Applies semantic JSON parameters to the writable UI4 parameter model,
        /// rebuilds UI4ParametersRO and assigns it to the DesignObject.
        /// </summary>
        private static void ApplyTranslationPlanToDesignObject(
            object designObject,
            TranslationPlan plan,
            bool invokeRecalc)
        {
            if (designObject == null || plan == null)
            {
                throw new ArgumentNullException(
                    designObject == null ? "designObject" : "plan");
            }

            foreach (var entry in plan.DesignObjectIntProperties)
            {
                TrySetIntProperty(
                    designObject,
                    entry.Key,
                    entry.Value);
            }

            var readonlyParameters = GetReadableMemberValue(
                designObject,
                "Parameters");
            var writable = CreateWritableParametersClone(
                readonlyParameters);
            if (writable == null)
            {
                throw new InvalidOperationException(
                    "Unable to create UI4Parameters.");
            }

            foreach (var entry in plan.ManagedIntParameters)
            {
                if (!TrySetManagedParameter(
                    writable,
                    entry.Key,
                    entry.Value))
                {
                    ProbeLog.Write(
                        "Parameters: managed value not found " +
                        entry.Key);
                }
            }

            ApplyNativeFillValues(writable, plan.ManagedIntParameters);

            var targetWritable = CreateWritableParametersClone(
                readonlyParameters);
            if (targetWritable == null ||
                !MergeModifiedParameters(
                    targetWritable,
                    writable,
                    readonlyParameters))
            {
                throw new InvalidOperationException(
                    "Unable to merge modified parameters.");
            }

            var rebuiltReadonly = RebuildReadonlyParameters(
                targetWritable);
            var property = designObject.GetType().GetProperty(
                "Parameters",
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance);
            if (rebuiltReadonly == null ||
                property == null ||
                !property.CanWrite)
            {
                throw new InvalidOperationException(
                    "Unable to assign rebuilt Parameters.");
            }

            property.SetValue(
                designObject,
                rebuiltReadonly,
                null);
            if (invokeRecalc)
            {
                TrySetBoolMember(
                    designObject,
                    "NeedRestitching",
                    true);
                InvokeDesignObjectRecalc(
                    designObject,
                    "Parameters.Recalc");
            }
        }

        private static object CreateWritableParametersClone(
            object readonlyParameters)
        {
            if (readonlyParameters == null)
            {
                return null;
            }

            var assembly = readonlyParameters.GetType().Assembly;
            var writableType = assembly.GetType(
                "Emg2_IO.UI4Parameters",
                false);
            var readonlyType = assembly.GetType(
                "Emg2_IO.UI4ParametersRO",
                false);
            var constructor = writableType?.GetConstructor(
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance,
                null,
                new[] { readonlyType },
                null);
            return constructor?.Invoke(
                new[] { readonlyParameters });
        }

        private static object RebuildReadonlyParameters(
            object writableParameters)
        {
            if (writableParameters == null)
            {
                return null;
            }

            var readonlyType = writableParameters
                .GetType()
                .Assembly
                .GetType("Emg2_IO.UI4ParametersRO", false);
            var constructor = readonlyType?.GetConstructor(
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance,
                null,
                new[] { writableParameters.GetType() },
                null);
            return constructor?.Invoke(
                new[] { writableParameters });
        }

        private static bool MergeModifiedParameters(
            object target,
            object modified,
            object originalReadonly)
        {
            var method = target?.GetType().GetMethod(
                "UpdateFromModifiedParams",
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance,
                null,
                new[]
                {
                    modified.GetType(),
                    originalReadonly.GetType()
                },
                null);
            if (method == null)
            {
                return false;
            }

            method.Invoke(
                target,
                new[] { modified, originalReadonly });
            return true;
        }

        private static bool TrySetManagedParameter(
            object parameters,
            string parameterName,
            int value)
        {
            var collection = GetReadableMemberValue(
                parameters,
                "ManagedParameterCollection") as IEnumerable;
            if (collection == null)
            {
                return false;
            }

            foreach (var item in collection)
            {
                var managed = GetReadableMemberValue(
                    item,
                    "ManagedParameter");
                if (!string.Equals(
                    Convert.ToString(managed),
                    parameterName,
                    StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var property = item.GetType().GetProperty(
                    "Value",
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance);
                if (property != null && property.CanWrite)
                {
                    property.SetValue(item, value, null);
                    return true;
                }
            }

            return false;
        }

        private static void ApplyNativeFillValues(
            object writableParameters,
            Dictionary<string, int> values)
        {
            var fill = GetReadableMemberValue(
                writableParameters,
                "A_FillParameters");
            if (fill == null)
            {
                return;
            }

            var map = new Dictionary<string, string>(
                StringComparer.OrdinalIgnoreCase)
            {
                { "PISngLunghezzaPunto", "SgnLunghezzaPunto" },
                { "PISormonto", "Sormonto" },
                { "PIAllungamentoPunto", "AllungamentoPunto" },
                { "PIDistanzaBordoImbastitureFondo", "DistanzaBordoImbastitureFondo" },
                { "PISngSfasamentoPuntoRaso", "SngSfasamentoPuntoRaso" },
                { "PILivelloRitiroPunti", "LivelloRitiroPunti" },
                { "PIPullX", "PullX" },
                { "PIPullY", "PullY" },
                { "PILunghezzaPuntoImbastituraFondo", "LunghezzaImbastituraFondo" },
                { "PIDensitaImbastituraFondo", "DensitaImbastituraFondo" },
                { "PIFillMinStitchLength", "FillMinStichLength" }
            };

            foreach (var entry in values)
            {
                string nativeName;
                if (map.TryGetValue(entry.Key, out nativeName))
                {
                    TrySetNativeFillInt(
                        fill,
                        nativeName,
                        entry.Value);
                }
            }
        }

        private static bool TrySetNativeFillInt(
            object fill,
            string enumName,
            int value)
        {
            foreach (var method in fill.GetType().GetMethods(
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance))
            {
                var parameters = method.GetParameters();
                if (!string.Equals(
                    method.Name,
                    "set_IntValue",
                    StringComparison.OrdinalIgnoreCase) ||
                    parameters.Length != 2 ||
                    !parameters[0].ParameterType.IsEnum)
                {
                    continue;
                }

                if (!Enum.IsDefined(
                    parameters[0].ParameterType,
                    enumName))
                {
                    continue;
                }

                var enumValue = Enum.Parse(
                    parameters[0].ParameterType,
                    enumName,
                    true);
                var converted = Convert.ChangeType(
                    value,
                    parameters[1].ParameterType);
                method.Invoke(fill, new[] { enumValue, converted });
                return true;
            }

            return false;
        }

        private static bool TrySetIntProperty(
            object instance,
            string propertyName,
            int value)
        {
            var property = instance?.GetType().GetProperty(
                propertyName,
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.Instance);
            if (property == null ||
                !property.CanWrite ||
                property.PropertyType != typeof(int))
            {
                return false;
            }

            property.SetValue(instance, value, null);
            return true;
        }
    }
}
