// PDFEditOrLauncher — lanceur Windows : ouvre les PDF et les images dans la version WEB de PDFEdit Or, dans le MÊME onglet.
//
// Windows sait confier un fichier à un programme, pas à un site web. Ce petit programme fait le pont :
//   - Au premier fichier, il démarre en arrière-plan (sans fenêtre), sert ce fichier sur 127.0.0.1 (cet ordinateur seulement)
//     et ouvre le navigateur sur le site avec « #ouvrir=PORT:SECRET:ID ». La page récupère le fichier puis « écoute » le lanceur.
//   - Aux fichiers suivants, le nouveau lancement s'adresse au lanceur déjà en route (canal Windows réservé à votre compte).
//     Si la page est toujours ouverte, elle reçoit le fichier dans un nouvel onglet de l'éditeur et le navigateur est ramené
//     au premier plan : aucun nouvel onglet de navigateur. Sinon, un nouvel onglet est ouvert.
//   - Il s'arrête seul quelques minutes après la fermeture de la page.
// Sécurité : écoute uniquement sur 127.0.0.1 ; secret aléatoire propre à votre compte ; seul le site configuré (en-tête Origin)
// peut lire les fichiers ; seuls les fichiers que vous ouvrez vous-même sont servis. Aucun fichier ne quitte l'ordinateur.
// Réglages : lanceur.ini, à côté du programme.
//
// Compilation : csc /target:winexe (fournie avec Windows ; voir installer.ps1). Compatible C# 5 (compilateur de .NET Framework 4).
// Essai sans navigateur : PDFEditOrLauncher.exe fichier.pdf --no-browser (affiche l'adresse d'ouverture, ou ACTIF).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    const string Title = "PDFEdit Or (web)";
    const long MaxBytes = 250L * 1024 * 1024;
    static readonly string[] Exts = { ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif" };

    class Item { public string Id; public string Path; public string Name; public long Size; public DateTime Added; public bool Fetched; }

    static readonly object Gate = new object();
    static readonly Dictionary<string, Item> Items = new Dictionary<string, Item>();
    static readonly List<string> Pending = new List<string>(); // fichiers à livrer à la page qui écoute
    static DateTime lastPoll = DateTime.MinValue;
    static DateTime lastActivity = DateTime.UtcNow;
    static string Secret, Origin, BaseUrl;
    static int Port;
    static volatile bool stop;

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);

    [STAThread]
    static int Main(string[] args)
    {
        bool noBrowser = false;
        string file = null;
        foreach (string a in args)
        {
            if (a == "--no-browser") noBrowser = true;
            else if (file == null) file = a;
        }
        if (file == null)
        {
            MessageBox.Show("Ce programme ouvre un PDF ou une image dans PDFEdit Or (web).\n\nClic droit sur un fichier, « Ouvrir avec », puis « " + Title + " ».", Title);
            return 1;
        }
        try { return Run(file, noBrowser); }
        catch (Exception e)
        {
            if (noBrowser) Console.Error.WriteLine(e.Message);
            else MessageBox.Show(e.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }

    // ---------- Réglages ----------

    static Dictionary<string, string> ReadConfig()
    {
        var cfg = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string path = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "lanceur.ini");
        if (!File.Exists(path)) return cfg;
        foreach (string raw in File.ReadAllLines(path, Encoding.UTF8))
        {
            string line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#") || line.StartsWith(";")) continue;
            int i = line.IndexOf('=');
            if (i > 0) cfg[line.Substring(0, i).Trim()] = line.Substring(i + 1).Trim();
        }
        return cfg;
    }

    static string Get(Dictionary<string, string> cfg, string key, string fallback)
    {
        string v;
        return cfg.TryGetValue(key, out v) && v.Length > 0 ? v : fallback;
    }

    static int GetInt(Dictionary<string, string> cfg, string key, int fallback)
    {
        int n;
        return int.TryParse(Get(cfg, key, ""), out n) ? n : fallback;
    }

    // Secret propre à ce compte Windows, gardé d'un lancement à l'autre (une page restée ouverte peut se reconnecter).
    static string LoadSecret()
    {
        string path = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "etat.ini");
        try
        {
            if (File.Exists(path))
                foreach (string l in File.ReadAllLines(path))
                    if (l.StartsWith("secret=") && l.Length >= 39) return l.Substring(7).Trim();
        }
        catch (IOException) { }
        string s = RandomHex(16);
        try { File.WriteAllText(path, "secret=" + s + "\r\n"); } catch (IOException) { }
        return s;
    }

    static string RandomHex(int bytes)
    {
        var b = new byte[bytes];
        using (var rng = new RNGCryptoServiceProvider()) rng.GetBytes(b);
        var sb = new StringBuilder();
        foreach (byte x in b) sb.Append(x.ToString("x2"));
        return sb.ToString();
    }

    // ---------- Fichier ----------

    static void Validate(string full)
    {
        if (!File.Exists(full)) throw new Exception("Fichier introuvable :\n" + full);
        string ext = System.IO.Path.GetExtension(full).ToLowerInvariant();
        if (Array.IndexOf(Exts, ext) < 0) throw new Exception("Type de fichier non pris en charge (" + ext + ").\nPDFEdit Or ouvre les PDF et les images (jpg, png, webp, bmp, gif).");
        long size = new FileInfo(full).Length;
        if (size > MaxBytes) throw new Exception("Fichier trop volumineux (" + (size / 1048576) + " Mo ; maximum " + (MaxBytes / 1048576) + " Mo).");
    }

    // À appeler sous verrou.
    static Item Add(string full)
    {
        var info = new FileInfo(full);
        var it = new Item { Id = RandomHex(8), Path = full, Name = info.Name, Size = info.Length, Added = DateTime.UtcNow };
        Items[it.Id] = it;
        return it;
    }

    // ---------- Lancement ----------

    static int Run(string file, bool noBrowser)
    {
        var cfg = ReadConfig();
        BaseUrl = Get(cfg, "url", "https://pdfedit-or.ardoisia.com/");
        Origin = new Uri(BaseUrl).GetLeftPart(UriPartial.Authority);
        string full = System.IO.Path.GetFullPath(file);
        Validate(full);
        string pipeName = "PDFEditOrLanceur_" + WindowsIdentity.GetCurrent().User.Value;
        string browser = Get(cfg, "navigateur", "");

        string reply = Ask(pipeName, full, 0); // un lanceur tourne-t-il déjà ?
        if (reply == null)
        {
            bool created;
            Mutex mutex = new Mutex(true, "Local\\" + pipeName, out created);
            if (created) return Serve(full, cfg, pipeName, noBrowser, browser, mutex);
            reply = Ask(pipeName, full, 40); // un autre lancement démarre à l'instant : on attend qu'il écoute
            if (reply == null) throw new Exception("Le lanceur n'a pas pu démarrer. Réessayez.");
        }
        return Answer(reply, noBrowser, browser, full);
    }

    // Envoie le chemin au lanceur en route ; renvoie sa réponse, ou null s'il n'y en a pas.
    static string Ask(string pipeName, string full, int retries)
    {
        for (int i = 0; i <= retries; i++)
        {
            try
            {
                using (var c = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut))
                {
                    c.Connect(i == 0 ? 250 : 150);
                    var w = new StreamWriter(c, new UTF8Encoding(false));
                    w.WriteLine(full);
                    w.Flush();
                    string r = new StreamReader(c, Encoding.UTF8).ReadLine();
                    if (r != null) return r;
                }
            }
            catch (TimeoutException) { }
            catch (IOException) { }
            Thread.Sleep(120);
        }
        return null;
    }

    static int Answer(string reply, bool noBrowser, string browser, string full)
    {
        if (reply.StartsWith("ERREUR|")) throw new Exception(reply.Substring(7));
        string fileName = System.IO.Path.GetFileName(full);
        if (reply == "DEJA") // même fichier demandé deux fois de suite : la première ouverture est encore en cours
        {
            if (noBrowser) { Console.Out.WriteLine("DEJA"); Console.Out.Flush(); }
            else ShowToast("« " + fileName + " » est déjà en cours d'ouverture dans PDFEdit Or…", 3500, false).Join();
            return 0;
        }
        if (reply == "ACTIF")
        {
            if (noBrowser) { Console.Out.WriteLine("ACTIF"); Console.Out.Flush(); }
            else
            {
                Thread toast = ShowToast("« " + fileName + " » envoyé à PDFEdit Or (onglet déjà ouvert).", 3500, false);
                FocusBrowser();
                toast.Join();
            }
            return 0;
        }
        string[] p = reply.Split('|'); // INACTIF|port|secret|id
        string openUrl = BaseUrl.Split('#')[0] + "#ouvrir=" + p[1] + ":" + p[2] + ":" + p[3];
        if (noBrowser) { Console.Out.WriteLine(openUrl); Console.Out.Flush(); }
        else
        {
            Thread toast = ShowToast("Ouverture de « " + fileName + " » dans PDFEdit Or…", 3500, false);
            OpenBrowser(openUrl, browser);
            toast.Join();
        }
        return 0;
    }

    static void OpenBrowser(string openUrl, string browser)
    {
        if (browser.Length > 0 && File.Exists(browser))
            Process.Start(new ProcessStartInfo(browser, "\"" + openUrl + "\"") { UseShellExecute = false });
        else
            Process.Start(new ProcessStartInfo(openUrl) { UseShellExecute = true }); // navigateur par défaut
    }

    // Ramène au premier plan la fenêtre du navigateur qui affiche PDFEdit Or (si l'onglet est l'onglet actif).
    static bool FocusBrowser()
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, 512);
            if (sb.ToString().Contains("PDFEdit - ")) { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        if (found == IntPtr.Zero) return false;
        if (IsIconic(found)) ShowWindow(found, 9);
        return SetForegroundWindow(found);
    }

    // Petite fenêtre d'information en bas à droite (sans prendre le focus), pour montrer que le double-clic a été pris en compte.
    class ToastForm : Form
    {
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams
        {
            get { CreateParams cp = base.CreateParams; cp.ExStyle |= 0x08000000 | 0x00000080 | 0x00000008; return cp; } // NOACTIVATE | TOOLWINDOW | TOPMOST
        }
    }

    static Thread ShowToast(string text, int ms, bool background)
    {
        var th = new Thread(delegate ()
        {
            try
            {
                var f = new ToastForm();
                f.FormBorderStyle = FormBorderStyle.None;
                f.ShowInTaskbar = false;
                f.TopMost = true;
                f.StartPosition = FormStartPosition.Manual;
                f.BackColor = Color.FromArgb(38, 34, 26);
                f.Size = new Size(380, 64);
                Rectangle wa = Screen.PrimaryScreen.WorkingArea;
                f.Location = new Point(wa.Right - f.Width - 16, wa.Bottom - f.Height - 16);
                var l = new Label();
                l.Text = text;
                l.ForeColor = Color.FromArgb(240, 232, 208);
                l.Font = new Font("Segoe UI", 10f);
                l.Dock = DockStyle.Fill;
                l.Padding = new Padding(14, 0, 10, 0);
                l.TextAlign = ContentAlignment.MiddleLeft;
                f.Controls.Add(l);
                var timer = new System.Windows.Forms.Timer();
                timer.Interval = ms;
                timer.Tick += delegate { timer.Stop(); f.Close(); };
                f.Shown += delegate { timer.Start(); };
                Application.Run(f);
            }
            catch (Exception) { }
        });
        th.SetApartmentState(ApartmentState.STA);
        th.IsBackground = background;
        th.Start();
        return th;
    }

    // ---------- Serveur (arrière-plan) ----------

    static int Serve(string first, Dictionary<string, string> cfg, string pipeName, bool noBrowser, string browser, Mutex mutex)
    {
        int basePort = GetInt(cfg, "port", 47650);
        int idle = Math.Max(20, GetInt(cfg, "inactivite", 300));
        Secret = LoadSecret();
        TcpListener listener = null;
        for (int p = basePort; p < basePort + 10 && listener == null; p++)
        {
            try { var l = new TcpListener(IPAddress.Loopback, p); l.Start(); listener = l; Port = p; }
            catch (SocketException) { }
        }
        if (listener == null) throw new Exception("Aucun port local libre (" + basePort + " à " + (basePort + 9) + "). Fermez le programme qui l'utilise ou changez « port » dans lanceur.ini.");

        var pipeThread = new Thread(delegate () { PipeLoop(pipeName); });
        pipeThread.IsBackground = true;
        pipeThread.Start();

        Item it;
        lock (Gate) { it = Add(first); lastActivity = DateTime.UtcNow; }
        string openUrl = BaseUrl.Split('#')[0] + "#ouvrir=" + Port + ":" + Secret + ":" + it.Id;
        if (noBrowser) { Console.Out.WriteLine(openUrl); Console.Out.Flush(); }
        else
        {
            ShowToast("Ouverture de « " + it.Name + " » dans PDFEdit Or…", 3500, true); // en arrière-plan : le serveur continue
            OpenBrowser(openUrl, browser);
        }

        while (!stop)
        {
            if (listener.Pending())
            {
                TcpClient c = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(delegate (object o)
                {
                    try { Handle(c); }
                    catch (IOException) { }
                    catch (SocketException) { }
                    catch (ObjectDisposedException) { }
                    finally { c.Close(); }
                });
            }
            else Thread.Sleep(30);
            lock (Gate)
            {
                var old = new List<string>();
                foreach (var kv in Items) if ((DateTime.UtcNow - kv.Value.Added).TotalMinutes > 15) old.Add(kv.Key);
                foreach (string k in old) { Items.Remove(k); Pending.Remove(k); }
                if ((DateTime.UtcNow - lastActivity).TotalSeconds > idle) stop = true;
            }
        }
        listener.Stop();
        mutex.ReleaseMutex();
        return 0;
    }

    // Reçoit les fichiers des lancements suivants (canal nommé accessible à votre compte seulement).
    static void PipeLoop(string name)
    {
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
        while (!stop)
        {
            try
            {
                using (var pipe = new NamedPipeServerStream(name, PipeDirection.InOut, 4, PipeTransmissionMode.Byte, PipeOptions.None, 4096, 4096, security))
                {
                    pipe.WaitForConnection();
                    string path = new StreamReader(pipe, Encoding.UTF8).ReadLine();
                    string reply;
                    try { reply = Enqueue(path); }
                    catch (Exception e) { reply = "ERREUR|" + e.Message.Replace("\r", " ").Replace("\n", " "); }
                    var w = new StreamWriter(pipe, new UTF8Encoding(false));
                    w.WriteLine(reply);
                    w.Flush();
                    pipe.WaitForPipeDrain();
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    static string Enqueue(string path)
    {
        if (string.IsNullOrEmpty(path)) throw new Exception("Aucun fichier reçu.");
        Validate(path);
        lock (Gate)
        {
            foreach (var kv in Items)
            {
                Item o = kv.Value;
                double age = (DateTime.UtcNow - o.Added).TotalSeconds;
                if (o.Path == path && ((!o.Fetched && age < 60) || age < 5)) { lastActivity = DateTime.UtcNow; return "DEJA"; }
            }
            Item it = Add(path);
            lastActivity = DateTime.UtcNow;
            if ((DateTime.UtcNow - lastPoll).TotalSeconds < 30) { Pending.Add(it.Id); return "ACTIF"; } // une page écoute : elle prend le fichier
            return "INACTIF|" + Port + "|" + Secret + "|" + it.Id;                                      // sinon, un nouvel onglet l'ouvrira
        }
    }

    // ---------- HTTP (127.0.0.1) ----------

    static string ReadHead(NetworkStream s)
    {
        var sb = new StringBuilder();
        var buf = new byte[1];
        while (sb.Length < 8192)
        {
            if (s.Read(buf, 0, 1) <= 0) return null;
            sb.Append((char)buf[0]);
            if (sb.Length >= 4 && sb.ToString(sb.Length - 4, 4) == "\r\n\r\n") return sb.ToString();
        }
        return null;
    }

    static bool SecretOk(string given)
    {
        if (given == null || given.Length != Secret.Length) return false;
        int diff = 0;
        for (int i = 0; i < Secret.Length; i++) diff |= given[i] ^ Secret[i];
        return diff == 0;
    }

    static void Handle(TcpClient c)
    {
        c.ReceiveTimeout = 3000;
        c.SendTimeout = 20000;
        NetworkStream s = c.GetStream();
        string head = ReadHead(s);
        if (head == null) return;
        string[] lines = head.Split(new[] { "\r\n" }, StringSplitOptions.None);
        string[] first = lines[0].Split(' ');
        if (first.Length < 2) return;
        string method = first[0];
        string[] seg = first[1].Split('?')[0].Split('/'); // "", "m"|"f"|"attente", secret, id
        string reqOrigin = "";
        foreach (string l in lines)
            if (l.StartsWith("Origin:", StringComparison.OrdinalIgnoreCase)) reqOrigin = l.Substring(7).Trim();

        if (reqOrigin != Origin) { Send(s, 403, "Forbidden", null, null, 0); return; }
        if (method == "OPTIONS") { Send(s, 204, "No Content", null, null, 0); return; }
        if (method != "GET" || seg.Length < 3 || !SecretOk(seg[2])) { Send(s, 404, "Not Found", null, null, 0); return; }

        if (seg[1] == "attente") // la page écoute : on lui livre les fichiers dès qu'il y en a (attente longue, 20 s au plus)
        {
            var got = new List<Item>();
            DateTime end = DateTime.UtcNow.AddSeconds(20);
            while (!stop)
            {
                lock (Gate)
                {
                    lastPoll = DateTime.UtcNow;
                    lastActivity = lastPoll;
                    if (Pending.Count > 0 || DateTime.UtcNow > end)
                    {
                        foreach (string id in Pending) { Item x; if (Items.TryGetValue(id, out x)) got.Add(x); }
                        Pending.Clear();
                        break;
                    }
                }
                Thread.Sleep(120);
            }
            var sb = new StringBuilder("[");
            for (int i = 0; i < got.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append("{\"id\":\"").Append(got[i].Id).Append("\",\"name\":").Append(JsonString(got[i].Name)).Append(",\"size\":").Append(got[i].Size).Append('}');
            }
            byte[] body = Encoding.UTF8.GetBytes(sb.Append(']').ToString());
            Send(s, 200, "OK", "application/json; charset=utf-8", body, body.Length);
            return;
        }

        Item it = null;
        lock (Gate) { if (seg.Length >= 4) Items.TryGetValue(seg[3], out it); lastActivity = DateTime.UtcNow; }
        if (it == null) { Send(s, 404, "Not Found", null, null, 0); return; }
        if (seg[1] == "m")
        {
            byte[] json = Encoding.UTF8.GetBytes("{\"name\":" + JsonString(it.Name) + ",\"size\":" + it.Size + "}");
            Send(s, 200, "OK", "application/json; charset=utf-8", json, json.Length);
            return;
        }
        if (seg[1] == "f")
        {
            lock (Gate) { it.Fetched = true; }
            using (FileStream fs = File.OpenRead(it.Path))
            {
                Send(s, 200, "OK", "application/octet-stream", null, fs.Length);
                var buf = new byte[65536];
                int n;
                while ((n = fs.Read(buf, 0, buf.Length)) > 0) s.Write(buf, 0, n);
            }
            s.Flush();
            lock (Gate) { lastActivity = DateTime.UtcNow; }
            return;
        }
        Send(s, 404, "Not Found", null, null, 0);
    }

    static void Send(NetworkStream s, int code, string reason, string type, byte[] body, long length)
    {
        var sb = new StringBuilder();
        sb.Append("HTTP/1.1 ").Append(code).Append(' ').Append(reason).Append("\r\n");
        sb.Append("Access-Control-Allow-Origin: ").Append(Origin).Append("\r\n");
        sb.Append("Access-Control-Allow-Methods: GET, OPTIONS\r\n");
        sb.Append("Access-Control-Allow-Headers: *\r\n");
        sb.Append("Access-Control-Allow-Private-Network: true\r\n");
        sb.Append("Access-Control-Max-Age: 60\r\n");
        sb.Append("Vary: Origin\r\n");
        sb.Append("Cache-Control: no-store\r\n");
        sb.Append("X-Content-Type-Options: nosniff\r\n");
        if (type != null) sb.Append("Content-Type: ").Append(type).Append("\r\n");
        sb.Append("Content-Length: ").Append(length).Append("\r\n");
        sb.Append("Connection: close\r\n\r\n");
        byte[] head = Encoding.ASCII.GetBytes(sb.ToString());
        s.Write(head, 0, head.Length);
        if (body != null) s.Write(body, 0, body.Length);
        s.Flush();
    }

    static string JsonString(string v)
    {
        var sb = new StringBuilder("\"");
        foreach (char ch in v)
        {
            if (ch == '"') sb.Append("\\\"");
            else if (ch == '\\') sb.Append("\\\\");
            else if (ch < 0x20) sb.Append("\\u").Append(((int)ch).ToString("x4"));
            else sb.Append(ch);
        }
        return sb.Append('"').ToString();
    }
}
