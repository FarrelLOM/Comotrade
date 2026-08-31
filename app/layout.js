import './globals.css';

export const metadata = {
  title: 'Rempah Nusantara — Sejarah & Perjalanan',
  description:
    'Menelusuri sejarah dan perjalanan rempah-rempah Nusantara yang telah mengubah dunia.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
