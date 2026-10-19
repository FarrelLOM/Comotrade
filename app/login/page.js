import AuthForm from '@/app/auth/AuthForm';

export const metadata = { title: 'Login — Rempah Nusantara' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
