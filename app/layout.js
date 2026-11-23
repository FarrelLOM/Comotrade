import 'leaflet/dist/leaflet.css';
import './globals.css';
import MarketplaceChrome from './components/MarketplaceChrome';
import FloatingMessages from './components/FloatingMessages';
import { CurrencyProvider } from './components/CurrencyProvider';

export const metadata = {
  title: 'Rempah Nusantara — Marketplace',
  description:
    'Marketplace rempah dan produk unggulan Nusantara.',
  icons: {
    icon: '/Pictures/asset/logo.png',
    apple: '/Pictures/asset/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <MarketplaceChrome />
        <CurrencyProvider>
          {children}
          <FloatingMessages />
        </CurrencyProvider>
      </body>
    </html>
  );
}
