import React, { useMemo, useState } from 'react';
import { PublicLegalPageLayout } from '../components/PublicLegalPageLayout';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '../i18n';
import { getPrivacyPageCopy } from '../content/privacyAndTermsContent';

function getLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const BACK = {
  et: 'Tagasi rakendusse',
  en: 'Back to app',
  fi: 'Takaisin sovellukseen',
};

export default function PrivacyPage() {
  const [locale] = useState(getLocale);
  const normalized = String(locale || '').toLowerCase();
  const copy = useMemo(() => getPrivacyPageCopy(normalized), [normalized]);
  const back = useMemo(() => {
    if (normalized.startsWith('et')) return BACK.et;
    if (normalized.startsWith('fi')) return BACK.fi;
    return BACK.en;
  }, [normalized]);

  return (
    <PublicLegalPageLayout
      title={copy.pageTitle}
      backToApp={back}
      relatedLink={copy.related}
    >
      {copy.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </PublicLegalPageLayout>
  );
}
