import './globals.css';
import './gloabal.feed.css';
import { ClerkProvider } from '@clerk/nextjs';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { PlayerProvider } from '../context/PlayerContext';
import Navbar from '../components/Navbar';
import GlobalPlayer from '../components/GlobalPlayer';
import MobileBottomNav from '../components/MobileBottomNav';
import PWARegister from '../components/PWARegister';
import { clerkAppearance } from '../lib/clerkAppearance';

export const metadata = {
  title: 'सुर-मिथिला | Sur-Mithila - The Sacred Maithili Cultural Music Archive',
  description: 'Mithila cultural music streaming and archive platform featuring thousands of verified Maithili folk songs, Vidyapati padavali, Vivah sanskar, Chhath geet, and bilingual lyrics.',
  applicationName: 'सुर-मिथिला',
  keywords: ['Maithili songs', 'Vidyapati', 'Sharda Sinha', 'Mithila folk', 'Bhagwati Geet', 'Vivah Geet', 'Sur-Mithila'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'सुर-मिथिला'
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  openGraph: {
    title: 'सुर-मिथिला | Sur-Mithila',
    description: 'The Sacred Maithili Cultural Music Archive',
    url: 'https://sur-mithila.vercel.app',
    siteName: 'Sur-Mithila',
    locale: 'mai_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'सुर-मिथिला | Sur-Mithila',
    description: 'The Sacred Maithili Cultural Music Archive',
  },
  manifest: '/manifest.json'
};

export const viewport = {
  themeColor: '#06080F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <html lang="mai">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="mobile-web-app-capable" content="yes" />
        </head>
        <body>
          <LanguageProvider>
            <AuthProvider>
              <PlayerProvider>
                <div className="site-layout-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '96px' }}>
                  <Navbar />
                  <main style={{ flex: 1, maxWidth: '1380px', width: '100%', margin: '0 auto', padding: '24px 20px' }}>
                    {children}
                  </main>
                  <GlobalPlayer />
                  <MobileBottomNav />
                  <PWARegister />
                </div>
              </PlayerProvider>
            </AuthProvider>
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}