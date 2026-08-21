import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { RideFeed } from '@/components/ride-feed';

export const metadata = {
  title: 'Find a ride'
};

export default async function RideFeedPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return <RideFeed />;
}
