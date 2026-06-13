'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { en } from './en';
import { ar } from './ar';

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';
export type TranslationDict = Record<string, string>;

const dictionaries: Record<Locale, TranslationDict> = { en, ar };

interface LanguageContextType {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  dir: 'ltr',
  setLocale: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = 'sawaqly_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  // Load saved locale on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  // Update <html> attributes and persist whenever locale changes
  useEffect(() => {
    if (!mounted) return;
    const dir: Direction = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>): string => {
      let text = dictionaries[locale]?.[key] || dictionaries.en[key] || key;
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return text;
    },
    [locale]
  );

  const dir: Direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ locale, dir, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
