import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import './globals.css';

const display = Barlow_Condensed({
  variable: '--font-condensed',
  subsets: ['latin'],
  weight: ['700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const body = Barlow({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const description =
  'Diesel performance tuning, parts and repair for Duramax, Powerstroke and Cummins trucks. Request service online or call (843) 995-9252.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://luckydiesel.com'),
  title: 'Lucky Diesel | Diesel Performance, Tuning & Repair',
  description,
  openGraph: {
    title: 'Lucky Diesel | Diesel Performance, Tuning & Repair',
    description,
    type: 'website',
    images: [{ url: '/images/shop-card.jpg', width: 1600, height: 900, alt: 'Lucky Diesel business card on a diesel engine' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c0b',
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  name: BUSINESS.legalName,
  telephone: '+1-843-995-9252',
  email: BUSINESS.email,
  url: BUSINESS.store,
  logo: `${BUSINESS.store}/images/logo.png`,
  sameAs: Object.values(BUSINESS.social),
  knowsAbout: PLATFORMS.map((p) => `${p.name} diesel`),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
