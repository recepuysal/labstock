import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { AlinacaklarListesi, type AlinacakKaydi } from '@/components/alinacaklar-listesi';
import { sozlukAl } from '@/lib/i18n/sunucu';
import { kullaniciAl } from '@/lib/oturum';

export const dynamic = 'force-dynamic';

export default async function AlinacaklarSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  const { kullaniciId: hedef, saltOkunur, izlenenAdi } = aktif;
  const sozlukler = await sozlukAl();
  const s = sozlukler.envanter.alinacaklar;

  const supabase = await createClient();
  const temelKolonlar = 'id, malzeme_adi, adet, not_metni, link, durum, created_at, olusturan';
  const ekKolonlar = 'tedarikci, birim_fiyat, para_birimi, siparis_tarihi, alinma_tarihi, guncellendi';

  const tam = await supabase
    .from('alinacaklar')
    .select(`${temelKolonlar}, ${ekKolonlar}`)
    .eq('user_id', hedef)
    .order('created_at', { ascending: false });

  // 0016 migration'ı uygulanmamışsa ek kolonlar yok — temel alanlarla göster.
  const migrationEksik = Boolean(tam.error);
  let data: unknown[] | null = tam.data;
  if (migrationEksik) {
    const temel = await supabase
      .from('alinacaklar')
      .select(temelKolonlar)
      .eq('user_id', hedef)
      .order('created_at', { ascending: false });
    data = temel.data;
  }

  const kayitlar = (data ?? []) as AlinacakKaydi[];

  // "Kim ekledi" için isim haritası: kendi adın, izlediğin hesabın adı ve
  // (kendi deponda) seni izleyenlerin adları.
  const user = await kullaniciAl();
  const isimler: Record<string, string> = {};
  if (saltOkunur) {
    isimler[hedef] = izlenenAdi || s.depoSahibi;
  } else {
    const { data: izleyenler } = await supabase.rpc('gozlemcilerimi_listele');
    for (const i of (izleyenler ?? []) as { id: string; ad: string }[]) isimler[i.id] = i.ad;
  }

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
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
          {sozlukler.ortak.buton.envantereDon}
        </Link>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {s.baslik}
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {s.aciklama}
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 12, fontWeight: 600 }}>
          {saltOkunur ? (
            <span style={{ color: 'var(--copper)' }}>
              {s.izledigin(izlenenAdi || sozlukler.ortak.ustBar.bagliHesap)}
            </span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{s.kendiDepon}</span>
          )}
        </p>

        <AlinacaklarListesi
          kayitlar={kayitlar}
          isimler={isimler}
          benimId={user?.id ?? null}
          simdi={Date.now()}
          detaylarAcik={!migrationEksik}
        />
      </div>
    </main>
  );
}
