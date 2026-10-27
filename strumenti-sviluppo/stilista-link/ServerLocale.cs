using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace StilistaHostSkeleton
{
    internal sealed class Richiesta
    {
        public string Metodo;
        public string Percorso;
        public Dictionary<string, string> Query = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> Intestazioni = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public byte[] Corpo = new byte[0];
    }

    internal sealed class Risposta
    {
        public int Stato = 200;
        public string Tipo = "application/json; charset=utf-8";
        public byte[] Corpo = new byte[0];

        public static Risposta Testo(string testo, string tipo = "application/json; charset=utf-8", int stato = 200)
        {
            return new Risposta { Stato = stato, Tipo = tipo, Corpo = Encoding.UTF8.GetBytes(testo ?? "") };
        }
    }

    /// <summary>
    /// Un HTTP minimo su TcpListener, solo su 127.0.0.1: niente HttpListener, che senza diritti di
    /// amministratore chiede una prenotazione dell'indirizzo. Una richiesta per connessione.
    /// Il browser può leggere le risposte solo da pagine localhost o da quella della suite (CORS), le POST
    /// vogliono l'intestazione X-RG-Link, e l'Host dev'essere 127.0.0.1 o localhost: così una pagina qualsiasi
    /// non può mandare niente a Stilista.
    /// </summary>
    internal sealed class ServerLocale
    {
        private const int CorpoMassimo = 64 * 1024 * 1024;
        private readonly int _porta;
        private readonly Func<Richiesta, Risposta> _gestore;
        private TcpListener _ascolto;

        public ServerLocale(int porta, Func<Richiesta, Risposta> gestore)
        {
            _porta = porta;
            _gestore = gestore;
        }

        public void Avvia()
        {
            _ascolto = new TcpListener(IPAddress.Loopback, _porta);
            _ascolto.Start();
            var filo = new Thread(Ascolta) { IsBackground = true, Name = "RGLink.Server" };
            filo.Start();
        }

        private void Ascolta()
        {
            while (true)
            {
                TcpClient cliente;
                try
                {
                    cliente = _ascolto.AcceptTcpClient();
                }
                catch (Exception ex)
                {
                    ProbeLog.Write("RGLink.Server.Stop: " + ex.Message);
                    return;
                }
                ThreadPool.QueueUserWorkItem(_ => Servi(cliente));
            }
        }

        private void Servi(TcpClient cliente)
        {
            using (cliente)
            {
                try
                {
                    cliente.ReceiveTimeout = 30000;
                    var flusso = cliente.GetStream();
                    var richiesta = Leggi(flusso);
                    if (richiesta == null)
                    {
                        return;
                    }
                    var origine = richiesta.Intestazioni.TryGetValue("Origin", out var o) ? o : null;
                    Risposta risposta;
                    if (!HostLocale(richiesta.Intestazioni.TryGetValue("Host", out var h) ? h : null))
                    {
                        // un nome che punta a 127.0.0.1 (DNS rebinding): la pagina sarebbe «dello stesso sito»
                        risposta = Risposta.Testo("{\"ok\":false,\"errore\":\"solo 127.0.0.1 o localhost\"}", stato: 421);
                    }
                    else if (richiesta.Metodo == "OPTIONS")
                    {
                        risposta = new Risposta { Stato = 204 };
                    }
                    else if (richiesta.Metodo == "POST" && !richiesta.Intestazioni.ContainsKey("X-RG-Link"))
                    {
                        risposta = Risposta.Testo("{\"ok\":false,\"errore\":\"manca X-RG-Link\"}", stato: 403);
                    }
                    else
                    {
                        try
                        {
                            risposta = _gestore(richiesta);
                        }
                        catch (Exception ex)
                        {
                            ProbeLog.Write("RGLink.Server.Errore " + richiesta.Percorso + ": " + ex);
                            risposta = Risposta.Testo("{\"ok\":false,\"errore\":" + Json.Stringa(ex.Message) + "}", stato: 500);
                        }
                    }
                    Scrivi(flusso, risposta, origine);
                }
                catch (Exception ex)
                {
                    ProbeLog.Write("RGLink.Server.Connessione: " + ex.Message);
                }
            }
        }

        private static Richiesta Leggi(Stream flusso)
        {
            // intestazioni fino alla riga vuota
            var testa = new MemoryStream();
            while (true)
            {
                var b = flusso.ReadByte();
                if (b < 0)
                {
                    return null;
                }
                testa.WriteByte((byte)b);
                var n = (int)testa.Length;
                var buf = testa.GetBuffer();
                if (n >= 4 && buf[n - 4] == '\r' && buf[n - 3] == '\n' && buf[n - 2] == '\r' && buf[n - 1] == '\n')
                {
                    break;
                }
                if (testa.Length > 65536)
                {
                    return null;
                }
            }
            var righe = Encoding.ASCII.GetString(testa.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
            var prima = righe[0].Split(' ');
            if (prima.Length < 2)
            {
                return null;
            }
            var richiesta = new Richiesta { Metodo = prima[0].ToUpperInvariant() };
            var indirizzo = prima[1];
            var domanda = indirizzo.IndexOf('?');
            richiesta.Percorso = domanda >= 0 ? indirizzo.Substring(0, domanda) : indirizzo;
            if (domanda >= 0)
            {
                foreach (var coppia in indirizzo.Substring(domanda + 1).Split('&'))
                {
                    var uguale = coppia.IndexOf('=');
                    var chiave = Uri.UnescapeDataString(uguale >= 0 ? coppia.Substring(0, uguale) : coppia);
                    var valore = uguale >= 0 ? Uri.UnescapeDataString(coppia.Substring(uguale + 1).Replace('+', ' ')) : "";
                    if (chiave.Length > 0)
                    {
                        richiesta.Query[chiave] = valore;
                    }
                }
            }
            for (var i = 1; i < righe.Length; i++)
            {
                var due = righe[i].IndexOf(':');
                if (due > 0)
                {
                    richiesta.Intestazioni[righe[i].Substring(0, due).Trim()] = righe[i].Substring(due + 1).Trim();
                }
            }
            if (richiesta.Intestazioni.TryGetValue("Content-Length", out var lunghezzaTesto) &&
                int.TryParse(lunghezzaTesto, out var lunghezza) && lunghezza > 0)
            {
                if (lunghezza > CorpoMassimo)
                {
                    throw new InvalidOperationException("corpo troppo grande: " + lunghezza);
                }
                var corpo = new byte[lunghezza];
                var letti = 0;
                while (letti < lunghezza)
                {
                    var n = flusso.Read(corpo, letti, lunghezza - letti);
                    if (n <= 0)
                    {
                        throw new EndOfStreamException("corpo interrotto");
                    }
                    letti += n;
                }
                richiesta.Corpo = corpo;
            }
            return richiesta;
        }

        private static void Scrivi(Stream flusso, Risposta risposta, string origine)
        {
            var testa = new StringBuilder();
            testa.Append("HTTP/1.1 ").Append(risposta.Stato).Append(' ').Append(risposta.Stato < 300 ? "OK" : "Errore").Append("\r\n");
            testa.Append("Content-Type: ").Append(risposta.Tipo).Append("\r\n");
            testa.Append("Content-Length: ").Append(risposta.Corpo.Length).Append("\r\n");
            testa.Append("Cache-Control: no-store\r\n");
            testa.Append("Connection: close\r\n");
            if (OrigineAmmessa(origine))
            {
                testa.Append("Access-Control-Allow-Origin: ").Append(origine).Append("\r\n");
                testa.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                testa.Append("Access-Control-Allow-Headers: Content-Type, X-RG-Link\r\n");
                testa.Append("Access-Control-Allow-Private-Network: true\r\n");
                testa.Append("Vary: Origin\r\n");
            }
            testa.Append("\r\n");
            var byteTesta = Encoding.ASCII.GetBytes(testa.ToString());
            flusso.Write(byteTesta, 0, byteTesta.Length);
            flusso.Write(risposta.Corpo, 0, risposta.Corpo.Length);
            flusso.Flush();
        }

        /// <summary>Le pagine localhost (la suite in sviluppo) e quella dell'indirizzo della suite (indirizzo.txt).</summary>
        private static bool OrigineAmmessa(string origine)
        {
            return origine != null &&
                   (origine.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) ||
                    origine.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(origine, "http://localhost", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(origine, Configurazione.OrigineSuite, StringComparison.OrdinalIgnoreCase));
        }

        private static bool HostLocale(string host)
        {
            if (host == null)
            {
                return true; // HTTP/1.0 senza Host: non viene da un browser
            }
            var due = host.LastIndexOf(':');
            var nome = due > 0 && !host.EndsWith("]") ? host.Substring(0, due) : host;
            return string.Equals(nome, "127.0.0.1", StringComparison.Ordinal) ||
                   string.Equals(nome, "localhost", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(nome, "[::1]", StringComparison.Ordinal);
        }
    }

    /// <summary>JSON scritto a mano per le risposte piccole e ad hoc.</summary>
    internal static class Json
    {
        public static string Stringa(string valore)
        {
            if (valore == null)
            {
                return "null";
            }
            var sb = new StringBuilder("\"");
            foreach (var c in valore)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        public static string Numero(double valore)
        {
            return valore.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
