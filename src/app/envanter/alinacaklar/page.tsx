import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { AlinacaklarListesi, type AlinacakKaydi } from '@/components/alinacaklar-listesi';

export const dynamic = 'force-dynamic';

export default async function AlinacaklarSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  const { kullaniciId: hedef, saltOkunur } = aktif;

  const supabase = await createClient();
  const { data } = await supabase
    .from('alinacaklar')
    .select('id, malzeme_adi, adet, not_metni, link, durum')
    .eq('user_id', hedef)
    .order('created_at', { ascending: false });

  const kayitlar = (data ?? []) as AlinacakKaydi[];

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
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
          Envantere dön
        </Link>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Alınacaklar
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Envanterden bağımsız, hızlı bir alışveriş notu — malzeme adı, adet, not ve
          varsa tedarikçi linki.
        </p>

        <AlinacaklarListesi kayitlar={kayitlar} saltOkunur={saltOkunur} />
      </div>
    </main>
  );
}
