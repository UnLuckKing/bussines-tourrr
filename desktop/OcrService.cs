using System.Diagnostics;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage.Streams;

namespace BusinessTourLive;

internal sealed class OcrService
{
    private readonly OcrEngine _ocr = OcrEngine.TryCreateFromUserProfileLanguages()
        ?? throw new InvalidOperationException("Windows OCR kullanılamıyor.");

    public IReadOnlyList<(IntPtr Handle, string Title)> FindBusinessTourWindows()
    {
        var list = new List<(IntPtr, string)>();
        foreach (var p in Process.GetProcesses())
        {
            try
            {
                if (p.MainWindowHandle == IntPtr.Zero) continue;
                var title = p.MainWindowTitle?.Trim();
                if (string.IsNullOrWhiteSpace(title)) continue;
                if (title.Contains("Business Tour", StringComparison.OrdinalIgnoreCase) ||
                    p.ProcessName.Contains("BusinessTour", StringComparison.OrdinalIgnoreCase))
                    list.Add((p.MainWindowHandle, title));
            }
            catch { }
        }
        return list;
    }

    public async Task<string> ReadWindowAsync(IntPtr hwnd, CancellationToken ct = default)
    {
        using var bitmap = CaptureClient(hwnd);
        if (bitmap is null) return string.Empty;

        using var ms = new MemoryStream();
        bitmap.Save(ms, ImageFormat.Png);
        var bytes = ms.ToArray();

        using var ras = new InMemoryRandomAccessStream();
        using (var writer = new DataWriter(ras.GetOutputStreamAt(0)))
        {
            writer.WriteBytes(bytes);
            await writer.StoreAsync().AsTask(ct);
            await writer.FlushAsync().AsTask(ct);
        }
        ras.Seek(0);

        var decoder = await BitmapDecoder.CreateAsync(ras).AsTask(ct);
        var softwareBitmap = await decoder.GetSoftwareBitmapAsync(
            BitmapPixelFormat.Bgra8,
            BitmapAlphaMode.Premultiplied).AsTask(ct);

        if (softwareBitmap.PixelWidth > OcrEngine.MaxImageDimension ||
            softwareBitmap.PixelHeight > OcrEngine.MaxImageDimension)
        {
            var ratio = Math.Min(
                (double)OcrEngine.MaxImageDimension / softwareBitmap.PixelWidth,
                (double)OcrEngine.MaxImageDimension / softwareBitmap.PixelHeight);
            var transform = new BitmapTransform
            {
                ScaledWidth = (uint)Math.Max(1, softwareBitmap.PixelWidth * ratio),
                ScaledHeight = (uint)Math.Max(1, softwareBitmap.PixelHeight * ratio),
                InterpolationMode = BitmapInterpolationMode.Linear
            };
            softwareBitmap = await decoder.GetSoftwareBitmapAsync(
                BitmapPixelFormat.Bgra8,
                BitmapAlphaMode.Premultiplied,
                transform,
                ExifOrientationMode.IgnoreExifOrientation,
                ColorManagementMode.DoNotColorManage).AsTask(ct);
        }

        var result = await _ocr.RecognizeAsync(softwareBitmap).AsTask(ct);
        return result.Text ?? string.Empty;
    }

    private static Bitmap? CaptureClient(IntPtr hwnd)
    {
        if (!GetClientRect(hwnd, out var rect)) return null;
        var width = rect.Right - rect.Left;
        var height = rect.Bottom - rect.Top;
        if (width < 100 || height < 100) return null;

        var pt = new POINT { X = 0, Y = 0 };
        if (!ClientToScreen(hwnd, ref pt)) return null;

        var bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(bmp);
        g.CopyFromScreen(pt.X, pt.Y, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
        return bmp;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
}
