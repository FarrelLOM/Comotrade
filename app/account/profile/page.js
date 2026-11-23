import AccountGate from '../AccountGate';

export const metadata = { title: 'Profil — Rempah Nusantara' };

export default function ProfilePage() {
  return <AccountGate view="profile" />;
}
