import { PracticeScreen } from '@/src/components/practice/PracticeScreen';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/practice');
}

export default function PracticeRoute() {
  return <PracticeScreen />;
}
