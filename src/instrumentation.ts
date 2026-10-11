// Next sunucusu her başladığında bir kez çalışır (masaüstünde: uygulamanın her açılışı).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Sadece masaüstü uygulaması (Electron veri klasörünü bildirir); geliştirmede sayma.
  if (!process.env.LABSTOCK_VERI_DIZINI) return;
  const { kurulumBildir } = await import('./lib/kurulum');
  // Beklemeden: sunucunun açılışını geciktirmesin.
  void kurulumBildir();
}
