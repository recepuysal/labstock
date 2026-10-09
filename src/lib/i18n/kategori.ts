// Kategori adları veritabanında Türkçe saklanır (eski kayıtlarla uyum için
// değiştirilmez); İngilizce arayüzde sadece gösterirken çevrilir.
import type { Dil } from './index';

const KATEGORI_EN: Record<string, string> = {
  'Direnç': 'Resistor',
  'Potansiyometre': 'Potentiometer',
  'Kondansatör': 'Capacitor',
  'Bobin': 'Inductor',
  'Transformatör': 'Transformer',
  'Diyot': 'Diode',
  'Transistör': 'Transistor',
  'Entegre': 'IC',
  'Mikrodenetleyici / İşlemci': 'Microcontroller / Processor',
  'Bellek': 'Memory',
  'Güç Yönetimi IC': 'Power Management IC',
  'Arayüz IC': 'Interface IC',
  'Saat / Zamanlama': 'Clock / Timing',
  'Regülatör': 'Regulator',
  'İzolatör': 'Isolator',
  'RF / Kablosuz': 'RF / Wireless',
  'Optoelektronik': 'Optoelectronics',
  'Sensör': 'Sensor',
  'Röle': 'Relay',
  'Anahtar': 'Switch',
  'Konnektör': 'Connector',
  'Kablo / Terminal': 'Cable / Terminal',
  'Kristal / Osilatör': 'Crystal / Oscillator',
  'Filtre': 'Filter',
  'Koruma': 'Protection',
  'Motor / Fan / Aktüatör': 'Motor / Fan / Actuator',
  'Modül': 'Module',
  'Mekanik': 'Mechanical',
  'Diğer': 'Other',
};

/** Kayıtlı (Türkçe) kategori adını arayüz dilinde gösterir; bilinmeyen adlar olduğu gibi kalır. */
export function kategoriGoster(kategori: string | null | undefined, dil: Dil): string {
  if (!kategori) return '';
  return dil === 'en' ? (KATEGORI_EN[kategori] ?? kategori) : kategori;
}
