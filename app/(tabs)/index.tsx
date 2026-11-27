import { HomeTrainer } from '@/src/components/HomeTrainer';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/');
}

export default function HomeScreen() {
  return <HomeTrainer />;
}
