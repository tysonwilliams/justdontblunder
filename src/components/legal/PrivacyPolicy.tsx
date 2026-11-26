import { LegalDocument } from '@/src/components/legal/LegalDocument';
import { LegalPage } from '@/src/components/legal/LegalPage';
import { PRIVACY_EFFECTIVE_DATE, privacyIntro, privacySections } from '@/src/legal/privacyPolicy';

export function PrivacyPolicy() {
  return (
    <LegalPage eyebrow="Just Don't Blunder" title="Privacy">
      <LegalDocument
        effective={PRIVACY_EFFECTIVE_DATE}
        effectiveTestID="privacy-effective"
        intro={privacyIntro}
        sections={privacySections}
      />
    </LegalPage>
  );
}
