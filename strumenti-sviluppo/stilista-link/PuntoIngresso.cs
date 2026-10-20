using System;
using System.IO;
using System.Reflection;
using GmiGUI.Interfaces;

namespace StilistaHostSkeleton
{
    /// <summary>
    /// Il punto d'ingresso che il caricatore dei plugin di Stilista cerca nell'eseguibile.
    /// La scheda vera è CodexTab (Collegamento.cs).
    /// </summary>
    public sealed class StilistaLinkPlugin : IStilistaExtension
    {
        public string getName()
        {
            AppDomain.CurrentDomain.AssemblyResolve += DaStilista;
            return getPluginName();
        }

        public string getPluginName()
        {
            return "RGLINK";
        }

        public void Init(IStilista3 stilista)
        {
            ProbeLog.Write("RGLink.Plugin.Init");
        }

        public void Load(string[] args)
        {
        }

        public bool IsVisible()
        {
            return true;
        }

        public bool isEnabled()
        {
            return true;
        }

        // le DLL GMI stanno in bin\ dell'installazione, non accanto al plugin
        private static Assembly DaStilista(object sender, ResolveEventArgs args)
        {
            try
            {
                var nome = new AssemblyName(args.Name).Name;
                var candidato = Path.Combine(@"C:\GMI\Stilista3.3", "bin", nome + ".dll");
                return File.Exists(candidato) ? Assembly.LoadFile(candidato) : null;
            }
            catch
            {
                return null;
            }
        }
    }
}
