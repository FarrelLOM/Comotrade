import Dashboard from '@/app/dashboard/Dashboard';

export const metadata = { title: 'Portal Suplier — Rempah Nusantara' };

export default function AdminPage() {
  return <Dashboard adminOnly />;
}
