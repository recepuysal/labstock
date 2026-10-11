import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { githubIndirmeleri, istatistikleriGetir, yoneticiMi } from '@/lib/istatistik';
import { HaftalikGrafik } from '@/components/haftalik-grafik';
import { dilAl } from '@/lib/i18n/sunucu';
import { sozluk, yerel } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const kucukBaslik = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: 'var(--muted-2)',
  margin: '24px 0 10px',
} as const;

function Kutu({ etiket, deger, alt }: { etiket: string; deger: string; alt?: string }) {
  return (
    <div className="kart" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{etiket}</div>
      <div className="mn" style={{ fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: '-0.5px' }}>
        {deger}
      </div>
      {alt && <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>{alt}</div>}
    </div>
  );
}

const izgara = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 } as const;

export default async function IstatistikSayfasi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/giris');
  // Yönetici olmayan biri adresi bilse bile sayfanın varlığını görmesin.
  if (!(await yoneticiMi(supabase))) notFound();

  const [ist, github, dil] = await Promise.all([istatistikleriGetir(supabase), githubIndirmeleri(), dilAl()]);
  if (!ist) notFound();

  const so = sozluk(dil);
  const s = so.ayarlar.istatistik;
  const sayi = (n: number) => n.toLocaleString(yerel(dil));
  const tarih = (iso: string) => new Date(iso).toLocaleDateString(yerel(dil), { day: '2-digit', month: '2-digit', year: 'numeric' });
  const haftaEtiketi = (hafta: string) =>
    s.haftaEtiketi(new Date(hafta + 'T00:00:00').toLocaleDateString(yerel(dil), { day: '2-digit', month: '2-digit' }));
  const u = ist.uye;
  const k = ist.kullanim;

  return (
    <main style={{ minHeight: '100vh', overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link
          href="/ayarlar"
          className="btn"
          style={{ marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--copper)', borderColor: 'var(--copper-line)', fontWeight: 600 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {so.ortak.ustBar.ayarlar}
        </Link>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>{s.baslik}</h1>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {s.aciklama}
          {u.ilk_kayit ? ` ${s.ilkKayit(tarih(u.ilk_kayit))}` : ''}
        </p>

        <div className="mn" style={kucukBaslik}>{s.uyeler}</div>
        <div style={izgara}>
          <Kutu etiket={s.toplamUye} deger={sayi(u.toplam)} alt={s.dogrulanmis(sayi(u.dogrulanmis))} />
          <Kutu etiket={s.son7Giris} deger={sayi(u.son7_giris)} alt={s.son30Giris(sayi(u.son30_giris))} />
          <Kutu etiket={s.son7Yeni} deger={sayi(u.son7_yeni)} alt={s.son30Yeni(sayi(u.son30_yeni))} />
        </div>

        <HaftalikGrafik
          baslik={s.haftalikKayit}
          veriler={ist.haftalik.map((h) => ({ hafta: h.hafta, deger: h.yeni_uye, etiket: haftaEtiketi(h.hafta), degerMetni: s.kisi(sayi(h.yeni_uye)) }))}
        />
        <HaftalikGrafik
          baslik={s.haftalikAktif}
          aciklama={s.haftalikAktifAciklama}
          veriler={ist.haftalik.map((h) => ({ hafta: h.hafta, deger: h.aktif, etiket: haftaEtiketi(h.hafta), degerMetni: s.kisi(sayi(h.aktif)) }))}
        />
        <details style={{ marginTop: 8, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>{s.tabloGoster}</summary>
          <table className="mn" style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                {[s.hafta, s.yeniUye, s.aktif].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '4px 14px 4px 0', color: 'var(--muted)', fontWeight: 600 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ist.haftalik.map((h) => (
                <tr key={h.hafta}>
                  <td style={{ padding: '3px 14px 3px 0' }}>{tarih(h.hafta + 'T00:00:00')}</td>
                  <td style={{ padding: '3px 14px 3px 0' }}>{sayi(h.yeni_uye)}</td>
                  <td style={{ padding: '3px 14px 3px 0' }}>{sayi(h.aktif)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        <div className="mn" style={kucukBaslik}>{s.kullanim}</div>
        <div style={izgara}>
          <Kutu etiket={s.parcaEkleyen} deger={sayi(k.parca_ekleyen)} />
          <Kutu etiket={s.stokKalemi} deger={sayi(k.stok_kalemi)} alt={s.katalogParca(sayi(k.katalog_parca))} />
          <Kutu etiket={s.hareket} deger={sayi(k.hareket)} alt={s.son7Hareket(sayi(k.son7_hareket), sayi(k.son7_hareket_yapan))} />
          <Kutu etiket={s.gozlemci} deger={sayi(k.gozlemci)} />
          <Kutu etiket={s.aiEkleyen} deger={sayi(k.ai_anahtari_ekleyen)} alt={s.aiBugun(sayi(k.ai_istek_bugun))} />
        </div>

        <div className="mn" style={kucukBaslik}>{s.indirmeler}</div>
        {github ? (
          <div style={izgara}>
            <Kutu
              etiket={s.exeIndirme}
              deger={sayi(github.exeIndirme)}
              alt={github.linuxIndirme > 0 ? `${s.exeAciklama} · ${s.linuxIndirme(sayi(github.linuxIndirme))}` : s.exeAciklama}
            />
            <Kutu etiket={s.guncellemeKontrolu} deger={sayi(github.guncellemeKontrolu)} alt={s.surumSayisi(sayi(github.surumSayisi))} />
            {github.sonSurum && (
              <Kutu etiket={github.sonSurum.ad} deger={sayi(github.sonSurum.indirme)} alt={s.sonSurum(github.sonSurum.ad, sayi(github.sonSurum.indirme))} />
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{s.githubYok}</p>
        )}
        <p style={{ margin: '14px 0 24px', fontSize: 11.5, color: 'var(--muted-2)' }}>{s.store}</p>
      </div>
    </main>
  );
}
