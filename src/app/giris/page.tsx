import { AuthForm } from '@/components/auth-form';
import { girisYap } from '../auth-actions';

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
    />
  );
}
