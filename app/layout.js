import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { PlayerProvider } from '../context/PlayerContext';
import Navbar from '../components/Navbar';
import GlobalPlayer from '../components/GlobalPlayer';
import { clerkAppearance } from '../lib/clerkAppearance';

export const metadata = {
  title: 'सुर-मिथिला | Sur-Mithila - The Sacred Maithili Cultural Music Archive',
  description: 'Mithila cultural music streaming and archive platform featuring thousands of verified Maithili folk songs, Vidyapati padavali, Vivah sanskar, Chhath geet, and bilingual lyrics.',
  keywords: ['Maithili songs', 'Vidyapati', 'Sharda Sinha', 'Mithila folk', 'Bhagwati Geet', 'Vivah Geet', 'Sur-Mithila'],
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
  themeColor: '#0B0E1A',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <html lang="mai">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="apple-touch-icon" href="/icon.svg" />
        </head>
        <body>
          <LanguageProvider>
            <AuthProvider>
              <PlayerProvider>
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '96px' }}>
                  <Navbar />
                  <main style={{ flex: 1, maxWidth: '1380px', width: '100%', margin: '0 auto', padding: '24px 20px' }}>
                    {children}
                  </main>
                  <GlobalPlayer />
                </div>
              </PlayerProvider>
            </AuthProvider>
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}