using System;
using System.IO;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// Il registro del plugin. Prende il posto del ProbeLog del bridge (stesso nome, lo usa il codice copiato) ma
    /// scrive in un file suo, %TEMP%\rg-stilista-link.log: quello del bridge resta del bridge, e la
    /// disinstallazione cancella il nostro senza toccare l'altro.
    /// </summary>
    internal static class ProbeLog
    {
        private static readonly string LogPath =
            Path.Combine(Path.GetTempPath(), "rg-stilista-link.log");

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
