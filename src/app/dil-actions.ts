'use server';

import { cookies } from 'next/headers';
import { DIL_COOKIE, gecerliDil } from '@/lib/i18n';

export async function diliDegistir(dil: string): Promise<void> {
  const gecerli = gecerliDil(dil);
  if (!gecerli) return;
  (await cookies()).set(DIL_COOKIE, gecerli, { path: '/', maxAge: 60 * 60 * 24 * 365 * 5, sameSite: 'lax' });
}
