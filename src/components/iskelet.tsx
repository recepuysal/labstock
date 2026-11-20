/** Sayfa verisi sunucudan gelirken gösterilen yer tutucu. loading.tsx dosyaları
 * bunu döndürür: Next.js bağlantıya tıklandığı anda bunu gösterir, sayfa
 * hazır olunca değiştirir — tıklama artık "takılmış" gibi beklemez. */
export function Iskelet({ satir = 8 }: { satir?: number }) {
  return (
    <div className="iskelet" aria-busy="true" aria-live="polite">
      <div className="iskelet-cubuk" style={{ width: '32%', height: 22 }} />
      <div className="iskelet-cubuk" style={{ width: '55%' }} />
      {Array.from({ length: satir }, (_, i) => (
        <div key={i} className="iskelet-cubuk iskelet-satir" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}
