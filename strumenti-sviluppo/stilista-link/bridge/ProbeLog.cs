using System;
using System.IO;

namespace StilistaHostSkeleton
{
    internal static class ProbeLog
    {
        private static readonly string LogPath =
            Path.Combine(Path.GetTempPath(), "stilista-json-bridge.log");

        public static string PathOnDisk
        {
            get { return LogPath; }
        }

        public static void Write(string message)
        {
            try
            {
                File.AppendAllText(
                    LogPath,
                    "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") +
                    "] " + message + Environment.NewLine);
            }
            catch
            {
            }
        }
    }
}
