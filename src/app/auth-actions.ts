'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sozlukAl } from '@/lib/i18n/sunucu';
import type { Sozluk } from '@/lib/i18n';
import { girisSonrasiEkle } from '@/lib/yerel/ekleme';

export type AuthDurum = { hata?: string; bilgi?: string; kodBekleniyor?: string };

/** Supabase Auth hatasını kullanıcıya gösterilecek metne çevirir. Bilinen
 * hatalar (önce `code`, yoksa İngilizce mesaj) sözlükten gelir; bilinmeyenler
 * Supabase'in kendi mesajıyla gösterilir. */
function authHatasi(hata: { message: string; code?: string }, s: Sozluk): string {
  const h = s.ayarlar.authHata;
  const kod = hata.code ?? '';
  const mesaj = hata.message ?? '';
  const kucuk = mesaj.toLowerCase();

  if (kod === 'invalid_credentials' || mesaj === 'Invalid login credentials') return h.hataliGiris;
  if (kod === 'otp_expired' || mesaj === 'Token has expired or is invalid') return h.kodHatali;
  if (kod === 'user_already_exists' || kod === 'email_exists' || mesaj === 'User already registered') {
    return h.kullaniciVar;
  }
  if (kod === 'weak_password' || kucuk.startsWith('password should')) return h.zayifSifre;
  if (
    kod === 'email_address_invalid' ||
    kucuk.includes('unable to validate email') ||
    /email address .* is invalid/i.test(mesaj)
  ) {
    return h.gecersizEposta;
  }
  if (kod === 'over_email_send_rate_limit' || kucuk.includes('email rate limit')) return h.epostaLimiti;
  // "For security purposes, you can only request this after 37 seconds."
  const bekle = mesaj.match(/after (\d+) seconds?/i);
  if (bekle) return h.bekleSaniye(Number(bekle[1]));
  if (kod === 'over_request_rate_limit' || kucuk.includes('rate limit')) return h.istekLimiti;
  if (kod === 'signup_disabled' || kucuk.includes('signups not allowed')) return h.kayitKapali;
  if (kucuk.includes('fetch failed') || kucuk.includes('failed to fetch')) return h.agHatasi;
  return mesaj || s.ortak.hata.genel;
}

export async function girisYap(_onceki: AuthDurum, formData: FormData): Promise<AuthDurum> {
  const eposta = String(formData.get('eposta') ?? '').trim();
  const sifre = String(formData.get('sifre') ?? '');
  const devam = String(formData.get('devam') ?? '/envanter');

  const s = await sozlukAl();
  if (!eposta || !sifre) return { hata: s.ayarlar.auth.epostaSifreGerekli };

  const supabase = await createClient();
  const { data: giris, error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre });

  if (error) {
    if (error.code === 'email_not_confirmed' || error.message === 'Email not confirmed') {
      return { kodBekleniyor: eposta };
    }
    return { hata: authHatasi(error, s) };
  }

  // Çevrimdışı moddan "Buluta dön ve verilerimi ekle" ile gelindiyse.
  if (giris.user) await girisSonrasiEkle(supabase, giris.user.id);

  revalidatePath('/', 'layout');
  redirect(devam.startsWith('/') ? devam : '/envanter');
}

export async function kayitOl(_onceki: AuthDurum, formData: FormData): Promise<AuthDurum> {
  const ad = String(formData.get('ad') ?? '').trim();
  const eposta = String(formData.get('eposta') ?? '').trim();
  const sifre = String(formData.get('sifre') ?? '');
  const davetKodu = String(formData.get('davet_kodu') ?? '').trim();

  const s = await sozlukAl();
  if (!eposta || !sifre) return { hata: s.ayarlar.auth.epostaSifreGerekli };
  if (sifre.length < 8) return { hata: s.ayarlar.auth.sifreKisa };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: eposta,
    password: sifre,
    // davet_kodu, handle_new_user() tetikleyicisi tarafından okunup gözlemci
    // bağlantısı kuruluyor — e-posta doğrulaması açık olsa bile (oturum
    // henüz gelmeden) hesap oluşturulur oluşturulmaz bu çalışır.
    options: { data: { ad, davet_kodu: davetKodu || undefined } },
  });

  if (error) return { hata: authHatasi(error, s) };

  // E-posta doğrulaması açık: oturum gelmez, 6 haneli kod ekranına geç.
  if (!data.session) {
    return { kodBekleniyor: eposta };
  }

  revalidatePath('/', 'layout');
  redirect('/envanter');
}

/** Kayıt/giriş sırasında e-postaya gönderilen 6 haneli kodu doğrular. */
export async function kodDogrula(_onceki: AuthDurum, formData: FormData): Promise<AuthDurum> {
  const eposta = String(formData.get('eposta') ?? '').trim();
  const kod = String(formData.get('kod') ?? '').trim();

  const s = await sozlukAl();
  if (!eposta || !kod) return { hata: s.ayarlar.auth.kodGerekli };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: eposta, token: kod, type: 'signup' });

  if (error) {
    return { hata: authHatasi(error, s) };
  }

  revalidatePath('/', 'layout');
  redirect('/envanter');
}

/** Kodun süresi dolduysa ya da e-posta gelmediyse yeniden gönderir. */
export async function kodYenidenGonder(eposta: string): Promise<AuthDurum> {
  const s = await sozlukAl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: 'signup', email: eposta });
  if (error) return { hata: authHatasi(error, s) };
  return { bilgi: s.ayarlar.auth.yeniKodGonderildi };
}

export async function cikisYap() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/giris');
}
