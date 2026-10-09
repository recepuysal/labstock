// Sunucu bileşenleri ve server action'lar için dil yardımcıları.
import { cookies, headers } from 'next/headers';
import { DIL_COOKIE, basliktanDil, gecerliDil, sozluk, type Dil, type Sozluk } from './index';

export async function dilAl(): Promise<Dil> {
  const cerez = gecerliDil((await cookies()).get(DIL_COOKIE)?.value);
  if (cerez) return cerez;
  return basliktanDil((await headers()).get('accept-language'));
}

export async function sozlukAl(): Promise<Sozluk> {
  return sozluk(await dilAl());
}
