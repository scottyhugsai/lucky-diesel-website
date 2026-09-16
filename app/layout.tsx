import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

const display = Barlow_Condensed({
  variable: '--font-condensed',
  subsets: ['latin'],
  weight: ['800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const body = Barlow({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

const title = `Lucky Diesel | Diesel Performance, Tuning & Repair in ${BUSINESS.city}, ${BUSINESS.region}`;
const description = `Duramax, Powerstroke and Cummins performance tuning, parts and repair in ${BUSINESS.city}, ${BUSINESS.region}. Request service online or call ${BUSINESS.phoneDisplay}.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    title,
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
  url: siteUrl(),
  logo: `${siteUrl()}/images/logo.png`,
  image: `${siteUrl()}/images/shop-card.jpg`,
  address: { '@type': 'PostalAddress', addressLocality: BUSINESS.city, addressRegion: BUSINESS.region, addressCountry: 'US' },
  areaServed: BUSINESS.areaServed.map((name) => ({ '@type': 'City', name: `${name}, ${BUSINESS.region}` })),
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
