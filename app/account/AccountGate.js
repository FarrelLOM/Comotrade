import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AccountHome from './AccountHome';
import AccountSection from './AccountSection';

export default async function AccountGate({ view, children }) {
  const user = await getCurrentUser();
  if (!user) {
    const path = view === 'home' ? '/account' : `/account/${view}`;
    redirect(`/login?returnTo=${encodeURIComponent(path)}`);
  }
  if (view === 'home') return <AccountHome />;
  return <AccountSection view={view}>{children}</AccountSection>;
}
