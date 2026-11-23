import AccountGate from '../AccountGate';

export const metadata = { title: 'Alamat — Rempah Nusantara' };

export default function AddressesPage() {
  return <AccountGate view="addresses" />;
}
