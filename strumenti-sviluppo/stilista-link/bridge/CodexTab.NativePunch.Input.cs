using System;
using System.Collections.Generic;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Adapts semantic JSON vertices to the input contract expected by
        /// InputContornoAMano.
        ///
        /// JSON coordinates: millimetres.
        /// Stilista logical coordinates: microns.
        /// InputContornoAMano coordinates: physical canvas pixels.
        /// </summary>
        private static bool FeedNativeFreehandContour(
            object nativeBox,
            object operation,
            List<double[]> contour,
            string logPrefix)
        {
            return FeedNativeFreehandPath(
                nativeBox,
                operation,
                contour,
                true,
                logPrefix);
        }

        private static bool FeedNativeOpenPath(
            object nativeBox,
            object operation,
            List<double[]> path,
            string logPrefix)
        {
            return FeedNativeFreehandPath(
                nativeBox,
                operation,
                path,
                false,
                logPrefix);
        }

        private static bool FeedNativeFreehandPath(
            object nativeBox,
            object operation,
            List<double[]> path,
            bool closePath,
            string logPrefix)
        {
            try
            {
                if (nativeBox == null ||
                    operation == null ||
                    path == null ||
                    path.Count < (closePath ? 3 : 2))
                {
                    return false;
                }

                var toPhysical = FindPointTransformMethod(
                    nativeBox.GetType(),
                    "ToPhysicalPoint");
                var mouseMove = FindMethodInHierarchy(
                    operation.GetType(),
                    "MouseMove",
                    new[] { typeof(MouseEventArgs) });
                var mouseUp = FindMethodInHierarchy(
                    operation.GetType(),
                    "MouseUp",
                    new[] { typeof(MouseEventArgs) });
                if (toPhysical == null || mouseMove == null)
                {
                    ProbeLog.Write(
                        logPrefix + ": transform=" + (toPhysical != null) +
                        " mouseMove=" + (mouseMove != null));
                    return false;
                }

                var inputPoints = closePath
                    ? EnsureClosedContour(path)
                    : path;
                var fedPointCount = 0;
                var lastPhysicalPoint = Point.Empty;

                foreach (var coordinates in inputPoints)
                {
                    if (coordinates == null || coordinates.Length < 2)
                    {
                        continue;
                    }

                    var logicalPoint = new Point(
                        JsonBridge.MillimetersToMicrons(coordinates[0]),
                        JsonBridge.MillimetersToMicrons(coordinates[1]));
                    var physicalPoint = (Point)toPhysical.Invoke(
                        nativeBox,
                        new object[] { logicalPoint });
                    var mouseEvent = new MouseEventArgs(
                        MouseButtons.Left,
                        1,
                        physicalPoint.X,
                        physicalPoint.Y,
                        0);

                    // Calling the native input method is intentional. Direct writes to
                    // SourcePath do not execute the controller's hidden state updates.
                    mouseMove.Invoke(operation, new object[] { mouseEvent });
                    lastPhysicalPoint = physicalPoint;
                    fedPointCount++;

                    ProbeLog.Write(
                        logPrefix + ".Point[" + (fedPointCount - 1) + "]: logical=" +
                        logicalPoint.X + "," + logicalPoint.Y +
                        " physical=" + physicalPoint.X + "," + physicalPoint.Y);
                }

                if (mouseUp != null && fedPointCount > 0)
                {
                    mouseUp.Invoke(
                        operation,
                        new object[]
                        {
                            new MouseEventArgs(
                                MouseButtons.Left,
                                1,
                                lastPhysicalPoint.X,
                                lastPhysicalPoint.Y,
                                0)
                        });
                }

                ProbeLog.Write(logPrefix + ".Fed: " + fedPointCount);

                return fedPointCount >= (closePath ? 4 : 2);
            }
            catch (Exception ex)
            {
                ProbeLog.Write(
                    logPrefix + ": <error> " +
                    DescribeException(ex));
                return false;
            }
        }

        private static MethodInfo FindPointTransformMethod(
            Type type,
            string suffix)
        {
            for (var current = type; current != null; current = current.BaseType)
            {
                foreach (var method in current.GetMethods(
                    BindingFlags.Public |
                    BindingFlags.NonPublic |
                    BindingFlags.Instance |
                    BindingFlags.DeclaredOnly))
                {
                    var parameters = method.GetParameters();
                    if ((string.Equals(method.Name, suffix, StringComparison.Ordinal) ||
                         method.Name.EndsWith("." + suffix, StringComparison.Ordinal)) &&
                        method.ReturnType == typeof(Point) &&
                        parameters.Length == 1 &&
                        parameters[0].ParameterType == typeof(Point))
                    {
                        return method;
                    }
                }
            }

            return null;
        }

        /// <summary>
        /// Replays the two native clicks used by EditRdo to create a persistent
        /// orientation line. EditRdo treats the first MouseDown/MouseUp pair as P1
        /// and the second pair as P2; it is not a drag gesture.
        /// </summary>
        private static bool FeedNativeDirectionLine(
            object nativeBox,
            object operation,
            List<double[]> contour,
            double orientationDeg,
            string logPrefix)
        {
            try
            {
                int minX;
                int minY;
                int maxX;
                int maxY;
                if (nativeBox == null ||
                    operation == null ||
                    !TryGetJsonContourBounds(
                        contour,
                        out minX,
                        out minY,
                        out maxX,
                        out maxY))
                {
                    return false;
                }

                var toPhysical = FindPointTransformMethod(
                    nativeBox.GetType(),
                    "ToPhysicalPoint");
                var mouseDown = FindMethodInHierarchy(
                    operation.GetType(),
                    "MouseDown",
                    new[] { typeof(MouseEventArgs) });
                var mouseUp = FindMethodInHierarchy(
                    operation.GetType(),
                    "MouseUp",
                    new[] { typeof(MouseEventArgs) });
                if (toPhysical == null ||
                    mouseDown == null ||
                    mouseUp == null)
                {
                    ProbeLog.Write(
                        logPrefix + ": transform=" + (toPhysical != null) +
                        " down=" + (mouseDown != null) +
                        " up=" + (mouseUp != null));
                    return false;
                }

                var logicalPoints = BuildOrientationSegment(
                    minX,
                    minY,
                    maxX,
                    maxY,
                    orientationDeg);
                var startPhysical = (Point)toPhysical.Invoke(
                    nativeBox,
                    new object[] { logicalPoints[0] });
                var endPhysical = (Point)toPhysical.Invoke(
                    nativeBox,
                    new object[] { logicalPoints[1] });
                var startArgs = CreateLeftMouseEvent(startPhysical);
                var endArgs = CreateLeftMouseEvent(endPhysical);

                mouseDown.Invoke(operation, new object[] { startArgs });
                mouseUp.Invoke(operation, new object[] { startArgs });
                mouseDown.Invoke(operation, new object[] { endArgs });
                mouseUp.Invoke(operation, new object[] { endArgs });

                ProbeLog.Write(
                    logPrefix + ": angle=" + orientationDeg +
                    " logical=" + logicalPoints[0] +
                    " -> " + logicalPoints[1] +
                    " physical=" + startPhysical +
                    " -> " + endPhysical);
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

        private static Point[] BuildOrientationSegment(
            int minX,
            int minY,
            int maxX,
            int maxY,
            double orientationDeg)
        {
            var width = maxX - minX;
            var height = maxY - minY;
            var centerX = minX + width / 2.0;
            var centerY = minY + height / 2.0;
            var radians = orientationDeg * Math.PI / 180.0;
            var directionX = Math.Cos(radians);
            var directionY = Math.Sin(radians);
            var maxAlongX = Math.Abs(directionX) > 0.000001
                ? width / 2.0 / Math.Abs(directionX)
                : double.MaxValue;
            var maxAlongY = Math.Abs(directionY) > 0.000001
                ? height / 2.0 / Math.Abs(directionY)
                : double.MaxValue;
            var halfLength = Math.Min(maxAlongX, maxAlongY) * 0.8;

            return new[]
            {
                new Point(
                    (int)Math.Round(centerX - directionX * halfLength),
                    (int)Math.Round(centerY - directionY * halfLength)),
                new Point(
                    (int)Math.Round(centerX + directionX * halfLength),
                    (int)Math.Round(centerY + directionY * halfLength))
            };
        }

        private static MouseEventArgs CreateLeftMouseEvent(Point point)
        {
            return new MouseEventArgs(
                MouseButtons.Left,
                1,
                point.X,
                point.Y,
                0);
        }
    }
}
