import { cache } from 'react';
import { createClient } from './supabase/server';

/** Bu isteğin oturumdaki kullanıcısı. React `cache()` sayesinde bir sayfa
 * çiziminde (kök layout + envanter layout + sayfa + gozlemci) kaç kez çağrılırsa
 * çağrılsın Supabase Auth'a tek istek gider — eskiden her biri ayrı ayrı
 * getUser() yapıyordu ve hepsi sırayla bekleniyordu. */
export const kullaniciAl = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
