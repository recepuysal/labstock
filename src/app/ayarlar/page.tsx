import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { TemaAnahtari } from '@/components/tema-anahtari';
import { Hakkinda } from '@/components/hakkinda';
import { DisaAktarButonu } from '@/components/disa-aktar-butonu';
import { GozlemciErisimi } from '@/components/gozlemci-erisimi';
import { EtiketAyarlariFormu } from '@/components/etiket-ayarlari-formu';
import { GeriBildirimFormu } from '@/components/geri-bildirim-formu';
import { AiAnahtarlariKarti, type AiAnahtarSatiri } from '@/components/ai-anahtarlari-karti';
import { HaftalikYedekFormu } from '@/components/haftalik-yedek-formu';
import { etiketAyarlariniAl } from '@/lib/etiket-sunucu';
import { aiAnahtarlariGetir, bugunkuKullanimGetir, gunlukLimit, kullanimTakibiAktif } from '@/lib/ai-anahtarlari';
import { DilSecici } from '@/components/dil-secici';
import { yoneticiMi } from '@/lib/istatistik';
import { dilAl } from '@/lib/i18n/sunucu';
import { sozluk, yerel } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AyarlarSayfasi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/giris');

  const { data: profil } = await supabase
    .from('profiles')
    .select('davet_kodu, haftalik_yedek_aktif, yedek_eposta_adresi')
    .eq('id', user.id)
    .maybeSingle();

  const [hamAnahtarlar, bugunkuKullanim, takipAktif] = await Promise.all([
    aiAnahtarlariGetir(supabase, user.id),
    bugunkuKullanimGetir(supabase, user.id),
    kullanimTakibiAktif(supabase),
  ]);
  const aiAnahtarlari: AiAnahtarSatiri[] = hamAnahtarlar.map((a) => {
    const k = bugunkuKullanim.get(a.id);
    return {
      id: a.id,
      saglayici: a.saglayici,
      ad: a.ad,
      sonDortHane: a.anahtar.slice(-4),
      istek: k?.istek ?? 0,
      limit: gunlukLimit(a),
      kotaDoldu: k?.kota_doldu ?? false,
    };
  });

  const { data: gozlemciVerisi } = await supabase.rpc('gozlemcilerimi_listele');
  const gozlemciler = (gozlemciVerisi ?? []) as {
    id: string;
    ad: string;
    baglandi: string | null;
    son_gorulme: string | null;
  }[];

  const etiketAyarlari = await etiketAyarlariniAl();
  const aktif = await aktifGorunumAl();
  const saltOkunur = aktif?.saltOkunur ?? false;

  const dil = await dilAl();
  const so = sozluk(dil);
  const s = so.ayarlar;
  const yonetici = await yoneticiMi(supabase);

  return (
    <main style={{ minHeight: '100vh', overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link
          href="/envanter"
          className="btn"
          style={{
            marginBottom: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--copper)',
            borderColor: 'var(--copper-line)',
            fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {so.ortak.buton.envantereDon}
        </Link>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {s.sayfa.baslik}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {s.sayfa.aciklamaOnce}{' '}
          <Link href="/ayarlar/profil" style={{ color: 'var(--copper)' }}>
            {s.sayfa.profilLink}
          </Link>
          {s.sayfa.aciklamaSonra}
        </p>

        {yonetici && (
          <div className="kart" style={{ padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="mn" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 6 }}>
                {s.istatistik.kartBaslik}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{s.istatistik.kartAciklama}</p>
            </div>
            <Link href="/ayarlar/istatistik" className="btn btn-birincil">
              {s.istatistik.kartLink}
            </Link>
          </div>
        )}

        <div className="kart" style={{ padding: 20 }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
          >
            {so.ortak.dil.baslik.toLocaleUpperCase(yerel(dil))}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {so.ortak.dil.aciklama}
          </p>
          <DilSecici />
        </div>

        <div className="kart" style={{ padding: 20, marginTop: 16 }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
          >
            {s.gorunum.baslik}
          </div>
          <TemaAnahtari />
        </div>

        <EtiketAyarlariFormu baslangic={etiketAyarlari} />

        <GozlemciErisimi mevcutKod={profil?.davet_kodu ?? null} gozlemciler={gozlemciler} />

        <AiAnahtarlariKarti anahtarlar={aiAnahtarlari} takipAktif={takipAktif} />

        <HaftalikYedekFormu
          baslangicAktif={(profil?.haftalik_yedek_aktif as boolean | null) ?? false}
          baslangicEposta={(profil?.yedek_eposta_adresi as string | null) ?? null}
          girisEpostasi={user.email ?? null}
        />

        <div className="kart" style={{ padding: 20, marginTop: 16 }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
          >
            {s.iceAktar.baslik}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {s.iceAktar.aciklama}
          </p>
          {saltOkunur ? (
            <span className="btn" aria-disabled="true" style={{ height: 32, fontSize: 12.5, opacity: 0.45, cursor: 'default' }}>
              {s.iceAktar.buton}
            </span>
          ) : (
            <Link href="/envanter/ice-aktar" className="btn" style={{ height: 32, fontSize: 12.5 }}>
              {s.iceAktar.buton}
            </Link>
          )}
        </div>

        <DisaAktarButonu />

        <GeriBildirimFormu />

        <Hakkinda />
      </div>
    </main>
  );
}
