import AccountGate from './AccountGate';

export const metadata = { title: 'Akun Saya — Rempah Nusantara' };

export default function AccountPage() {
  return <AccountGate view="home" />;
}
