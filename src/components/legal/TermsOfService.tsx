import { LegalDocument } from '@/src/components/legal/LegalDocument';
import { LegalPage } from '@/src/components/legal/LegalPage';
import { TERMS_EFFECTIVE_DATE, termsIntro, termsSections } from '@/src/legal/terms';

export function TermsOfService() {
  return (
    <LegalPage eyebrow="Just Don't Blunder" title="Terms">
      <LegalDocument
        effective={TERMS_EFFECTIVE_DATE}
        effectiveTestID="terms-effective"
        intro={termsIntro}
        sections={termsSections}
      />
    </LegalPage>
  );
}
