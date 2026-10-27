using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;

namespace StilistaHostSkeleton
{
    public sealed partial class CodexTab
    {
        /// <summary>
        /// Per la ricerca: i valori semplici (numeri, testi, enum, colori) raggiungibili dai campi degli oggetti
        /// selezionati, fino a qualche livello, ognuno col suo percorso. Confrontando due oggetti si vede dove sta
        /// quello che li distingue (il colore del laser, per esempio). Solo campi: i getter possono fare cose.
        /// </summary>
        private object Foglie(int profondita)
        {
            var sb = new StringBuilder("{\"ok\":true,\"oggetti\":[");
            var selezionati = Selezionati();
            for (var i = 0; i < selezionati.Count; i++)
            {
                if (i > 0) sb.Append(',');
                var foglie = new List<KeyValuePair<string, string>>();
                RaccogliFoglie(selezionati[i], "", profondita, new HashSet<object>(new PerRiferimento()), foglie);
                sb.Append('{').Append(string.Join(",", foglie.Select(f => Json.Stringa(f.Key) + ":" + Json.Stringa(f.Value)))).Append('}');
            }
            sb.Append("]}");
            return Risposta.Testo(sb.ToString());
        }

        private static void RaccogliFoglie(object o, string dove, int resto, HashSet<object> visti, List<KeyValuePair<string, string>> foglie)
        {
            if (o == null || foglie.Count > 20000)
            {
                return;
            }
            var tipo = o.GetType();
            if (o is Color colore)
            {
                foglie.Add(new KeyValuePair<string, string>(dove, "colore #" + colore.R.ToString("X2") + colore.G.ToString("X2") + colore.B.ToString("X2") + " a" + colore.A));
                return;
            }
            if (tipo.IsPrimitive || tipo.IsEnum || o is string || o is decimal || o is DateTime || o is Guid)
            {
                foglie.Add(new KeyValuePair<string, string>(dove, Convert.ToString(o)));
                return;
            }
            if (resto <= 0 || (!tipo.IsValueType && !visti.Add(o)) || o is Delegate || o is Type || o is Assembly)
            {
                return;
            }
            if (o is IEnumerable lista && !(o is string))
            {
                var n = 0;
                if (o is ICollection c)
                {
                    foglie.Add(new KeyValuePair<string, string>(dove + ".#", c.Count.ToString()));
                    if (c.Count > 16) return; // i punti dei percorsi: troppi e non servono
                }
                try
                {
                    foreach (var e in lista)
                    {
                        if (n >= 16) break;
                        RaccogliFoglie(e, dove + "[" + n++ + "]", resto - 1, visti, foglie);
                    }
                }
                catch
                {
                }
                return;
            }
            const BindingFlags tutti = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly;
            for (var t = tipo; t != null && t != typeof(object); t = t.BaseType)
            {
                foreach (var f in t.GetFields(tutti))
                {
                    object v;
                    try
                    {
                        v = f.GetValue(o);
                    }
                    catch
                    {
                        continue;
                    }
                    RaccogliFoglie(v, dove + "/" + t.Name + "." + f.Name, resto - 1, visti, foglie);
                }
            }
        }

        /// <summary>
        /// Il colore con cui Stilista disegna un oggetto laser: non è il filo del suo ago (tutti i laser di un ago
        /// hanno lo stesso) ma il colore dei suoi parametri laser, l'unico campo Color di UILaserParamsRO
        /// (UI4ParametersRO.A_LaserParameters). Null per un oggetto che non è laser.
        /// </summary>
        private static string ColoreLaser(object oggetto)
        {
            try
            {
                if (!(GetReadableMemberValue(oggetto, "ContainsLaser") is bool laser) || !laser)
                {
                    return null;
                }
                const BindingFlags tutti = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
                var parametri = oggetto.GetType().GetFields(tutti).Concat(oggetto.GetType().BaseType?.GetFields(tutti) ?? new FieldInfo[0])
                    .FirstOrDefault(f => f.FieldType.Name == "UI4ParametersRO")?.GetValue(oggetto);
                var deiLaser = parametri?.GetType().GetField("A_LaserParameters", tutti)?.GetValue(parametri);
                for (var t = deiLaser?.GetType(); t != null && t != typeof(object); t = t.BaseType)
                {
                    var campi = t.GetFields(tutti | BindingFlags.DeclaredOnly).Where(f => f.FieldType == typeof(Color)).ToList();
                    if (campi.Count == 1 && campi[0].GetValue(deiLaser) is Color c && c.A > 0)
                    {
                        return "#" + c.R.ToString("X2") + c.G.ToString("X2") + c.B.ToString("X2");
                    }
                }
            }
            catch
            {
            }
            return null;
        }

        private sealed class PerRiferimento : IEqualityComparer<object>
        {
            public new bool Equals(object a, object b) => ReferenceEquals(a, b);
            public int GetHashCode(object o) => RuntimeHelpers.GetHashCode(o);
        }
    }
}
