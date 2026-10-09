import { konumTipiGoster, type Konum } from '@/lib/types';
import { sozluk, yerel } from '@/lib/i18n';
import { dilAl } from '@/lib/i18n/sunucu';

function ataZinciri(konum: Konum, harita: Map<string, Konum>): Konum[] {
  const zincir: Konum[] = [];
  let simdiki: Konum | undefined = konum;
  while (simdiki) {
    zincir.unshift(simdiki);
    simdiki = simdiki.parent_id ? harita.get(simdiki.parent_id) : undefined;
  }
  return zincir;
}

export async function KonumHaritasi({
  konumlar,
  konumId,
  sayilar,
}: {
  konumlar: Konum[];
  konumId: string | null;
  sayilar: Record<string, number>;
}) {
  const dil = await dilAl();
  const sozlukler = sozluk(dil);
  const s = sozlukler.envanter.konumHaritasi;
  if (!konumId) {
    return (
      <div className="kart" style={{ padding: 16 }}>
        <div
          className="mn"
          style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)' }}
        >
          {s.baslik}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
          {s.atanmamis}
        </p>
      </div>
    );
  }

  const harita = new Map(konumlar.map((k) => [k.id, k]));
  const buradaki = harita.get(konumId);
  if (!buradaki) return null;

  const zincir = ataZinciri(buradaki, harita);
  const kardesler = konumlar
    .filter((k) => k.parent_id === buradaki.parent_id)
    .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));

  const ebeveyn = buradaki.parent_id ? harita.get(buradaki.parent_id) : undefined;
  const dolu = kardesler.filter((k) => (sayilar[k.id] ?? 0) > 0).length;
  const ornekTip = kardesler.find((k) => k.tip)?.tip;
  const cocukTipi = ornekTip
    ? konumTipiGoster(ornekTip, dil, kardesler.length).toLocaleLowerCase(yerel(dil))
    : kardesler.length === 1
      ? sozlukler.envanter.konumGenel
      : sozlukler.envanter.konumGenelCogul;

  return (
    <div className="kart" style={{ padding: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)' }}
      >
        {s.baslik}
      </div>

      <div className="mn" style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>
        {buradaki.kod ?? buradaki.ad}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
        {zincir.map((k) => k.ad).join(' > ')}
      </div>

      {kardesler.length > 1 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginTop: 14,
            }}
          >
            {kardesler.map((k) => {
              const secili = k.id === buradaki.id;
              const doluMu = (sayilar[k.id] ?? 0) > 0;
              return (
                <div
                  key={k.id}
                  className="mn"
                  title={k.ad}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 11,
                    fontWeight: 600,
                    background: secili ? 'var(--copper)' : doluMu ? 'var(--copper-soft)' : 'var(--bg)',
                    color: secili ? '#fdfbf7' : doluMu ? 'var(--copper-dark)' : 'var(--muted-2)',
                    border: secili ? 'none' : '1px solid var(--line)',
                  }}
                >
                  {k.kod ?? k.ad}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 8 }}>
            {s.ozet(ebeveyn?.ad ?? '', kardesler.length, cocukTipi, dolu)}
          </div>
        </>
      )}
    </div>
  );
}
