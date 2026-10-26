'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const LANGUAGES = [
  {
    id: 'maithili',
    code: 'mai',
    label: 'मैथिली (द्विभाषी)',
    shortLabel: 'मैथिली',
    badge: 'द्विभाषी',
    description: 'पारंपरिक मैथिली संग अंग्रेजी संकेत (Maithili + English cues)',
  },
  {
    id: 'maithili_plus',
    code: 'mai_plus',
    label: 'मैथिली प्लस (शुद्ध)',
    shortLabel: 'मैथिली+',
    badge: 'शुद्ध',
    description: '१००% शुद्ध पारंपरिक मैथिली (Zero English / Authentic Maithili)',
  },
  {
    id: 'english',
    code: 'en',
    label: 'English',
    shortLabel: 'English',
    badge: 'Pure EN',
    description: '100% Global English Interface',
  },
];

/**
 * Strips English / Roman parenthesized cues from bilingual strings.
 * e.g. "सभ गीत बजाउ (Play All)" -> "सभ गीत बजाउ"
 * e.g. "मिथिला प्रमाणित गायक (Verified)" -> "मिथिला प्रमाणित गायक"
 * e.g. "समदाउन (Samdaun - Farewell)" -> "समदाउन"
 */
export function stripEnglishCues(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .replace(/\s*\([A-Za-z0-9\s.,!?'/&+\-_:]+\)/g, '')
    .replace(/\s*-\s*[A-Za-z\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function LanguageProvider({ children }) {
  // 'maithili' | 'maithili_plus' | 'english'
  const [language, setLanguageState] = useState('maithili');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('sur_mithila_lang');
      if (savedLang && (savedLang === 'maithili' || savedLang === 'maithili_plus' || savedLang === 'english')) {
        setLanguageState(savedLang);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setLanguage = (newLang) => {
    if (newLang === 'maithili' || newLang === 'maithili_plus' || newLang === 'english') {
      setLanguageState(newLang);
      try {
        localStorage.setItem('sur_mithila_lang', newLang);
      } catch {
        /* storage unavailable */
      }
    }
  };

  const toggleLanguage = () => {
    let nextLang = 'maithili';
    if (language === 'maithili') nextLang = 'maithili_plus';
    else if (language === 'maithili_plus') nextLang = 'english';
    else nextLang = 'maithili';
    setLanguage(nextLang);
  };

  /**
   * Universal translation helper:
   * @param {string} bilingualMaithili - Current bilingual string (e.g. "सभ गीत बजाउ (Play All)")
   * @param {string} englishText - Pure English string (e.g. "Play All")
   * @param {string|null} pureMaithili - Optional explicit pure Maithili (defaults to auto-stripped bilingualMaithili)
   */
  const t = (bilingualMaithili, englishText, pureMaithili = null) => {
    if (language === 'english') {
      return englishText !== undefined && englishText !== null ? englishText : (bilingualMaithili || '');
    }
    if (language === 'maithili_plus') {
      if (pureMaithili) return pureMaithili;
      return stripEnglishCues(bilingualMaithili);
    }
    // Default 'maithili' (Standard Bilingual)
    return bilingualMaithili || '';
  };

  /**
   * Song title helper respecting current language mode
   */
  const formatSongTitle = (song) => {
    if (!song) return '';
    const canonical = song.title?.canonical || song.title?.devanagari || (typeof song.title === 'string' ? song.title : '');
    const roman = song.title?.roman || '';

    if (language === 'english') {
      return roman || canonical;
    }
    return canonical;
  };

  const isEnglish = language === 'english';
  const isMaithiliPlus = language === 'maithili_plus';
  const isBilingual = language === 'maithili';

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        formatSongTitle,
        isEnglish,
        isMaithiliPlus,
        isPureMaithili: isMaithiliPlus,
        isBilingual,
        LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback outside provider
    return {
      language: 'maithili',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (mai, en) => mai || en || '',
      formatSongTitle: (s) => s?.title?.canonical || s?.title || '',
      isEnglish: false,
      isMaithiliPlus: false,
      isPureMaithili: false,
      isBilingual: true,
      LANGUAGES,
    };
  }
  return context;
}
