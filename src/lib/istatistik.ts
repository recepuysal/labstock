// Yönetici istatistik paneli (Ayarlar → İstatistikler) için veri: Supabase'deki
// toplu sayılar (supabase/migrations/0007 → yonetici_istatistikleri RPC'si,
// sadece private.yoneticiler'deki hesaplar çağırabilir) ve GitHub sürüm
// indirme sayaçları (herkese açık API).

import { createClient } from './supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type HaftalikSatir = { hafta: string; yeni_uye: number; aktif: number };

export type Istatistikler = {
  uye: {
    toplam: number;
    dogrulanmis: number;
    son7_yeni: number;
    son30_yeni: number;
    son7_giris: number;
    son30_giris: number;
    ilk_kayit: string | null;
  };
  kullanim: {
    parca_ekleyen: number;
    stok_kalemi: number;
    katalog_parca: number;
    hareket: number;
    son7_hareket: number;
    son7_hareket_yapan: number;
    gozlemci: number;
    ai_anahtari_ekleyen: number;
    ai_istek_bugun: number;
  };
  haftalik: HaftalikSatir[];
};

export type GithubIndirmeleri = {
  surumSayisi: number;
  exeIndirme: number;
  linuxIndirme: number;
  guncellemeKontrolu: number;
  sonSurum: { ad: string; indirme: number } | null;
};

/** Oturumdaki kullanıcı yönetici mi? Fonksiyon yoksa (0007 göçü çalıştırılmamış) false. */
export async function yoneticiMi(supabase: Supabase): Promise<boolean> {
  const { data, error } = await supabase.rpc('yonetici_mi');
  return !error && data === true;
}

export async function istatistikleriGetir(supabase: Supabase): Promise<Istatistikler | null> {
  const { data, error } = await supabase.rpc('yonetici_istatistikleri');
  if (error || !data) return null;
  return data as Istatistikler;
}

export type KurulumIstatistikleri = {
  toplam: number;
  son24_aktif: number;
  son7_aktif: number;
  son7_yeni: number;
  cevrimdisi: number;
  platform: Record<string, number>;
  surum: Record<string, number>;
};

/** Anonim kurulum sayacı (0008 göçü); fonksiyon yoksa null. */
export async function kurulumIstatistikleri(supabase: Supabase): Promise<KurulumIstatistikleri | null> {
  const { data, error } = await supabase.rpc('kurulum_istatistikleri');
  if (error || !data) return null;
  return data as KurulumIstatistikleri;
}

export type SiteIndirmeleri = { toplam: number; bugun: number; son7: number; tur: Record<string, number> };

/** labstock.com.tr indirme butonu sayacı (0009 göçü); fonksiyon yoksa null. */
export async function siteIndirmeleri(supabase: Supabase): Promise<SiteIndirmeleri | null> {
  const { data, error } = await supabase.rpc('site_indirme_istatistikleri');
  if (error || !data) return null;
  return data as SiteIndirmeleri;
}

type GithubSurum = { tag_name: string; draft: boolean; prerelease: boolean; assets: { name: string; download_count: number }[] };

/** GitHub sürümlerindeki indirme sayaçları. Kurulum dosyası sayısı otomatik
 * güncellemeleri de içerir (her güncelleme yeni .exe / .AppImage'ı indirir). */
export async function githubIndirmeleri(): Promise<GithubIndirmeleri | null> {
  try {
    const yanit = await fetch('https://api.github.com/repos/recepuysal/labstock/releases?per_page=100', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 600 },
    });
    if (!yanit.ok) return null;
    const surumler = ((await yanit.json()) as GithubSurum[]).filter((s) => !s.draft && !s.prerelease);
    const say = (s: GithubSurum, kosul: (ad: string) => boolean) =>
      s.assets.filter((a) => kosul(a.name)).reduce((t, a) => t + a.download_count, 0);
    const linux = (ad: string) => ad.endsWith('.AppImage') || ad.endsWith('.deb');
    const exe = (ad: string) => ad.endsWith('.exe') || linux(ad);
    const son = surumler[0];
    return {
      surumSayisi: surumler.length,
      exeIndirme: surumler.reduce((t, s) => t + say(s, exe), 0),
      linuxIndirme: surumler.reduce((t, s) => t + say(s, linux), 0),
      guncellemeKontrolu: surumler.reduce((t, s) => t + say(s, (ad) => ad === 'latest.yml'), 0),
      sonSurum: son ? { ad: son.tag_name, indirme: say(son, exe) } : null,
    };
  } catch {
    return null;
  }
}
