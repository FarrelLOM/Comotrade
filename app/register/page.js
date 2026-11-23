import AuthForm from '@/app/auth/AuthForm';
import { safeReturnTo } from '@/lib/safe-return-to.mjs';

export const metadata = { title: 'Daftar — Rempah Nusantara' };

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  return <AuthForm mode="register" initialReturnTo={safeReturnTo(params?.returnTo)} initialError={params?.error || ''} />;
}
