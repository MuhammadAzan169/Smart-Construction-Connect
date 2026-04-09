import { create } from 'zustand';
import i18n from '@/lib/i18n';

export type Language = 'en' | 'ur';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const getInitial = (): Language => {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem('scc_language') as Language) || 'en';
};

const applyLanguage = (lang: Language) => {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
  localStorage.setItem('scc_language', lang);
  i18n.changeLanguage(lang);
};

const initial = getInitial();
// Apply on load (i18n.init handles its own language, but we sync dir/lang attrs)
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('lang', initial);
  document.documentElement.setAttribute('dir', initial === 'ur' ? 'rtl' : 'ltr');
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initial,
  setLanguage: (lang) => {
    applyLanguage(lang);
    set({ language: lang });
  },
  toggleLanguage: () =>
    set((state) => {
      const next = state.language === 'en' ? 'ur' : 'en';
      applyLanguage(next);
      return { language: next };
    }),
}));
