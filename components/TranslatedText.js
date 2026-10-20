'use client';

import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function TranslatedText({ maithili, english, dualFormat = false }) {
  const { language } = useLanguage();
  
  if (dualFormat) {
     return <>{language === 'maithili' ? `${maithili} (${english})` : `${english} (${maithili})`}</>;
  }

  return <>{language === 'maithili' ? maithili : english}</>;
}
