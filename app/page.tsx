import { redirect } from 'next/navigation';
import MarketingSite from '@/components/site/MarketingSite';
import { isBypassAuthEnabled } from '@/lib/runtime-config';

export default function HomePage() {
  if (isBypassAuthEnabled()) {
    redirect('/app');
  }

  return <MarketingSite />;
}
