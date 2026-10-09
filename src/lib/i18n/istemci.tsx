'use client';

// İstemci bileşenleri için dil bağlamı. Kök layout sunucuda dili belirler ve
// <DilSaglayici> ile aşağı geçirir; istemci bileşenleri useSozluk() kullanır.
import { createContext, useContext } from 'react';
import { sozluk, type Dil, type Sozluk } from './index';

const DilBaglami = createContext<Dil>('tr');

export function DilSaglayici({ dil, children }: { dil: Dil; children: React.ReactNode }) {
  return <DilBaglami.Provider value={dil}>{children}</DilBaglami.Provider>;
}

export function useDil(): Dil {
  return useContext(DilBaglami);
}

export function useSozluk(): Sozluk {
  return sozluk(useContext(DilBaglami));
}
