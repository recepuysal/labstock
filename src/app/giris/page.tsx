import { AuthForm } from '@/components/auth-form';
import { girisYap } from '../auth-actions';
import { hesapsizBasla } from '../ayarlar/depolama-actions';
import { yerelModDestekleniyor } from '@/lib/yerel/mod';

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  const { devam } = await searchParams;
  return (
    <AuthForm
      mod="giris"
      eylem={girisYap}
      devam={devam ?? '/envanter'}
      hesapsizEylem={yerelModDestekleniyor() ? hesapsizBasla : undefined}
    />
  );
}
