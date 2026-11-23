import Dashboard from '@/app/dashboard/Dashboard';
import AccountGate from '../AccountGate';

export const metadata = { title: 'Pesanan — Rempah Nusantara' };

export default function AccountOrdersPage() {
  return <AccountGate view="orders"><Dashboard section="orders" /></AccountGate>;
}
