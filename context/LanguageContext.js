'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('maithili'); // 'maithili' | 'english'

  useEffect(() => {
    const savedLang = localStorage.getItem('sur_mithila_lang');
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'maithili' ? 'english' : 'maithili';
    setLanguage(newLang);
    localStorage.setItem('sur_mithila_lang', newLang);
  };

  const t = (maithiliText, englishText) => {
    return language === 'maithili' ? maithiliText : englishText;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
