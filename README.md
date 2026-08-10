# Business Tour — Canlı Analiz Merkezi 🎯

Business Tour (Online Multiplayer Board Game) için **hilesiz, matematik tabanlı**
canlı analiz aracı. Oyunu "kazandıran" kararları anında hesaplar: satın al,
ev/otel dik, Dünya Turu hedefi, Kayıp Ada, zar riski, kazanma ihtimali.

> ⚠️ **Hile yok.** Bu araç oyunun kurallarını değiştirmez, sana en iyi kararı
> **istatistiksel olarak** söyler. (Bellek hack'i / bot / otomatik kazanma
> hem hile olur hem de hesabının banlanmasına yol açar.)

## Nasıl çalışır?

1. Sayfayı aç (`python3 -m http.server 8000` → http://localhost:8000).
2. **Oyuncular** sekmesinden paraları, konumları, sahiplikleri gir
   (karelere tıklayarak da satın alabilirsin).
3. **Hamle** sekmesinde: zar at → ne yapman gerektiğini söyler;
   Dünya Turu'ndaysan "Tur Öner" ile en iyi hedefi bul.
4. **Simülasyon** sekmesi: mevcut durumu 10.000 kez oynatıp gerçek
   kazanma ihtimalini (%), ortalama serveti ve strateji tavsiyesini verir.
5. Tahtadaki 🔥 **Tehlike Haritası** (rakiplerin nereye düşeceği) ve
   💎 **Fırsat Haritası** (en kârlı boş kareler) ile ısı haritası modları.

## Özellikler

- 40 karelik klasik tahta (Başlangıç, Kayıp Ada, Dünya Turu, Vergi Dairesi köşeleri)
- Anlık öneri motoru: satın al / geliştir / atla / blokla / adada kal
- Dünya Turu: tüm sahipsiz+kendi kareleri için beklenen net değer (EV) sıralaması
- Zar olasılıkları (2-12, çift zar dahil) ve "zarı tekrar at" kararı
- Monte Carlo simülatörü: kazanma ihtimali, ortalama servet, son-tur tavsiyesi
- Kazanma yolları takibi: kenar / 3 grup / 4 tatil köyü + rakip tehdit uyarıları
- Festival & Dünya Şampiyonası desteği (kira ×2)
- **Harita Düzenle**: fiyat/kiraları kendi oyununa göre düzelt, tüm hesaplar anında güncellenir
- Durum `localStorage`'a kaydedilir (sayfa yenilense de korunur)

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Arayüz iskeleti |
| `styles.css` | Tema (karanlık) |
| `data.js` | Harita verisi (fiyatlar, kiralar, gruplar) |
| `engine.js` | Karar motoru + Monte Carlo simülasyonu (saf JS) |
| `app.js` | Arayüz mantığı |

## Strateji özeti (motorun kullandığı kanıtlanmış kurallar)

- Tatil köylerine (plaj) yatırım yapma — ROI %12-17; sadece rakibi bloklamak için al.
- İlk taraf (Granada→Şanghay) düşük ROI; paranı Londra→Tokyo arasına yatır.
- Çok sayıda 1 evli şehir yerine **az şehirde yüksek seviye** (2-3 ev / otel).
- Festival şehirleri her zaman al (kira ×2).
- Zar toplamları 6-7-8 ≈ %46 — Dünya Turu'nda bunu hesaplayarak git.
- Kayıp Ada: başta çık, sonda kal.
- Son 2 dakikada en zengin kazanır: parayı yüksek ROI'ye yatır, riskli zar atma.
