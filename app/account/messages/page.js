import Dashboard from '@/app/dashboard/Dashboard';
import AccountGate from '../AccountGate';

export const metadata = { title: 'Pesan — Rempah Nusantara' };

export default function AccountMessagesPage() {
  return <AccountGate view="messages"><Dashboard section="messages" /></AccountGate>;
}
