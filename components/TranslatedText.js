'use client';

import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function TranslatedText({ maithili, english, maithiliPlus, dualFormat = false }) {
  const { language, t } = useLanguage();

  if (dualFormat) {
    if (language === 'english') {
      return <>{english || maithili}</>;
    }
    if (language === 'maithili_plus') {
      return <>{maithiliPlus || maithili}</>;
    }
    return <>{maithili} ({english})</>;
  }

  return <>{t(maithili, english, maithiliPlus)}</>;
}
