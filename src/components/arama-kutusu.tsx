'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LSTK_DESENI } from '@/lib/etiket';

export function AramaKutusu() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [deger, setDeger] = useState(q);
  const [bekliyor, basla] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const girdi = useRef<HTMLInputElement>(null);

  // deger'i q'dan sürekli senkronize ETMEYİZ (yalnızca yukarıdaki useState(q)
  // ile ilk yüklemede alınır): hızlı yazarken art arda giden router.replace
  // çağrıları farklı sürelerde tamamlanabiliyor - eski (daha geç dönen) bir
  // çağrının q'su, kullanıcının o sırada yazmış olduğu daha yeni metni geri
  // alıp yazının "gidip gelmesine" yol açıyordu. Kutuyu her zaman kullanıcının
  // yazdığı değer sürer, URL sadece arkadan takip eder.

  // ⌘K / Ctrl+K → aramaya odaklan. (Komut paletinin ilk adımı.)
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        girdi.current?.focus();
        girdi.current?.select();
      }
    }
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, []);

  // Arama sadece malzeme listesinde (/envanter) uygulanır. Başka bir sayfadayken (ör. parça detayı)
  // URL'i olduğu yerde güncellemek bir şey göstermiyordu (o sayfa ?q= kullanmıyor) — orada yazarken
  // hiçbir yere gidilmez, Enter'a basınca listeye geçilir.
  const listede = pathname === '/envanter';

  function aramayiUygula(metin: string) {
    // Listedeyken mevcut filtreler (konum, kategori…) korunur; başka sayfadan gelince temiz arama
    const p = new URLSearchParams(listede ? searchParams.toString() : '');
    if (metin) p.set('q', metin);
    else p.delete('q');
    const sorgu = p.toString();
    const adres = sorgu ? `/envanter?${sorgu}` : '/envanter';
    basla(() => (listede ? router.replace(adres) : router.push(adres)));
  }

  // Listedeyken yazarken 300 ms sonra URL'i güncelle (canlı filtre)
  useEffect(() => {
    if (!listede || deger === q) return;
    const zamanlayici = setTimeout(() => aramayiUygula(deger), 300);
    return () => clearTimeout(zamanlayici);
    // aramayiUygula her çizimde yeniden oluşur; asıl bağımlılıkları (deger, q, listede) burada
  }, [deger, q, listede]);

  function tusaBasildi(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const metin = deger.trim();
    if (!listede && !metin) return; // başka sayfada boş Enter: bir yere gitme
    aramayiUygula(metin);
  }

  // Bir USB barkod/QR okuyucu, taradığı kodu klavyeymiş gibi çok hızlı "yazar".
  // Bu kod bizim etiket biçimimize (LSTK:P:… / LSTK:K:…) uyuyorsa arama yapmadan
  // doğrudan ilgili parçaya/konuma atla.
  function degisti(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    const eslesme = v.trim().match(LSTK_DESENI);
    if (eslesme) {
      const [, tur, id] = eslesme;
      setDeger('');
      basla(() => router.push(tur === 'P' ? `/envanter/${id}` : `/envanter?konum=${id}`));
      return;
    }
    setDeger(v);
  }

  return (
    <div
      style={{
        flex: 1,
        maxWidth: 520,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 11px',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--muted-2)"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.2" y1="16.2" x2="21" y2="21" />
      </svg>

      <input
        ref={girdi}
        value={deger}
        onChange={degisti}
        onKeyDown={tusaBasildi}
        placeholder="Parça, MPN, açıklama ara…"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 12.5,
        }}
      />

      <span
        className="mn"
        style={{
          fontSize: 10.5,
          color: 'var(--muted)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          padding: '2px 6px',
          opacity: bekliyor ? 0.4 : 1,
        }}
      >
        ⌘K
      </span>
    </div>
  );
}
