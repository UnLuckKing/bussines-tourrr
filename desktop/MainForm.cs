using System.Reflection;
using System.Text.Json;
using Microsoft.Web.WebView2.WinForms;

namespace BusinessTourLive;

internal sealed class MainForm : Form
{
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    private readonly ToolStripLabel _status = new("Hazır");
    private readonly ToolStripButton _start = new("▶ Canlı Analizi Başlat");
    private readonly ToolStripButton _stop = new("■ Durdur") { Enabled = false };
    private readonly ToolStripButton _refresh = new("↻ Oyun Penceresini Bul");
    private readonly ToolStripButton _topMost = new("📌 Üstte Tut") { CheckOnClick = true };
    private readonly OcrService _ocr = new();
    private CancellationTokenSource? _scanCts;
    private IntPtr _gameWindow = IntPtr.Zero;
    private string _gameTitle = string.Empty;

    public MainForm()
    {
        Text = "Business Tour Live — Anlık Analiz";
        Width = 1500;
        Height = 920;
        MinimumSize = new Size(1050, 680);
        StartPosition = FormStartPosition.CenterScreen;

        var strip = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, Dock = DockStyle.Top };
        strip.Items.AddRange([_start, _stop, new ToolStripSeparator(), _refresh, _topMost, new ToolStripSeparator(), _status]);
        Controls.Add(_web);
        Controls.Add(strip);

        _start.Click += (_, _) => StartScanning();
        _stop.Click += (_, _) => StopScanning();
        _refresh.Click += (_, _) => FindGameWindow(true);
        _topMost.CheckedChanged += (_, _) => TopMost = _topMost.Checked;
        FormClosing += (_, _) => StopScanning();
        Shown += async (_, _) => await InitializeWebAsync();
    }

    private async Task InitializeWebAsync()
    {
        try
        {
            _status.Text = "Arayüz hazırlanıyor…";
            var webRoot = ExtractWebAssets();
            await _web.EnsureCoreWebView2Async();
            _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _web.Source = new Uri(Path.Combine(webRoot, "index.html"));
            _status.Text = "Hazır — Business Tour'u açıp Canlı Analizi Başlat";
            FindGameWindow(false);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.ToString(), "Başlatma hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _status.Text = "Başlatma hatası";
        }
    }

    private string ExtractWebAssets()
    {
        var dir = Path.Combine(Path.GetTempPath(), "BusinessTourLive", "web");
        Directory.CreateDirectory(dir);
        var asm = Assembly.GetExecutingAssembly();
        foreach (var file in new[] { "index.html", "styles.css", "data.js", "engine.js", "app.js", "live-bridge.js" })
        {
            using var src = asm.GetManifestResourceStream("Web." + file)
                ?? throw new InvalidOperationException($"Gömülü web dosyası bulunamadı: {file}");
            using var dst = File.Create(Path.Combine(dir, file));
            src.CopyTo(dst);
        }
        return dir;
    }

    private bool FindGameWindow(bool notify)
    {
        var windows = _ocr.FindBusinessTourWindows();
        if (windows.Count == 0)
        {
            _gameWindow = IntPtr.Zero;
            _gameTitle = string.Empty;
            _status.Text = "Business Tour penceresi bulunamadı";
            if (notify)
                MessageBox.Show(this, "Business Tour'u açtıktan sonra tekrar dene. Oyun penceresi görünür ve küçültülmemiş olmalı.", "Pencere bulunamadı", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return false;
        }

        (_gameWindow, _gameTitle) = windows[0];
        _status.Text = "Bulundu: " + _gameTitle;
        return true;
    }

    private void StartScanning()
    {
        if (_scanCts is not null) return;
        if (_gameWindow == IntPtr.Zero && !FindGameWindow(true)) return;

        _scanCts = new CancellationTokenSource();
        _start.Enabled = false;
        _stop.Enabled = true;
        _status.Text = "CANLI — ekran okunuyor";
        _ = ScanLoopAsync(_scanCts.Token);
    }

    private void StopScanning()
    {
        _scanCts?.Cancel();
        _scanCts?.Dispose();
        _scanCts = null;
        _start.Enabled = true;
        _stop.Enabled = false;
        if (!IsDisposed) _status.Text = "Canlı analiz durduruldu";
    }

    private async Task ScanLoopAsync(CancellationToken ct)
    {
        var failures = 0;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (_gameWindow == IntPtr.Zero && !FindGameWindow(false))
                {
                    await Task.Delay(1200, ct);
                    continue;
                }

                var text = await _ocr.ReadWindowAsync(_gameWindow, ct);
                if (string.IsNullOrWhiteSpace(text))
                {
                    failures++;
                    if (failures >= 3)
                    {
                        _gameWindow = IntPtr.Zero;
                        failures = 0;
                    }
                }
                else
                {
                    failures = 0;
                    var payload = JsonSerializer.Serialize(new
                    {
                        text,
                        capturedAt = DateTimeOffset.Now.ToString("O"),
                        windowTitle = _gameTitle
                    });
                    await _web.CoreWebView2.ExecuteScriptAsync($"window.BTLive && window.BTLive.ingestOcr({payload});");
                    BeginInvoke(() => _status.Text = $"CANLI — {DateTime.Now:HH:mm:ss} güncellendi");
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                BeginInvoke(() => _status.Text = "OCR hatası: " + ex.Message);
                _gameWindow = IntPtr.Zero;
            }

            try { await Task.Delay(850, ct); }
            catch (OperationCanceledException) { break; }
        }
    }
}
