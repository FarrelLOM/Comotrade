import AuthForm from '@/app/auth/AuthForm';
import { safeReturnTo } from '@/lib/safe-return-to.mjs';

export const metadata = { title: 'Login — Rempah Nusantara' };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <AuthForm mode="login" initialReturnTo={safeReturnTo(params?.returnTo)} initialError={params?.error || ''} />;
}
