import AccountGate from '../AccountGate';

export const metadata = { title: 'Wallet — Rempah Nusantara' };

export default function WalletPage() {
  return <AccountGate view="wallet" />;
}
