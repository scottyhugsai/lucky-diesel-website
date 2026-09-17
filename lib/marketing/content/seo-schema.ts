import { BUSINESS } from '@/lib/site';

/** JSON-LD builders for public pages. Only facts we actually have; no ratings, no invented addresses. */

type Schema = Record<string, unknown>;

function provider(base: string): Schema {
  return { '@type': 'AutoRepair', name: BUSINESS.name, telephone: BUSINESS.phoneDisplay, url: base, areaServed: BUSINESS.areaServed.map((name) => ({ '@type': 'City', name })) };
}

export function serviceSchema(input: { name: string; description: string; url: string; serviceType: string; base: string; area?: string }): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url: input.url,
    provider: provider(input.base),
    areaServed: input.area ? { '@type': 'City', name: input.area } : BUSINESS.areaServed.map((name) => ({ '@type': 'City', name })),
  };
}

export function eventSchema(input: {
  name: string; description: string | null; startsAt: string; endsAt: string; url: string; location: string | null;
  priceCents: number; isFull: boolean; isPast: boolean; base: string;
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    startDate: input.startsAt,
    endDate: input.endsAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: input.location ?? BUSINESS.name, address: { '@type': 'PostalAddress', addressLocality: BUSINESS.city, addressRegion: BUSINESS.region, addressCountry: 'US' } },
    organizer: { '@type': 'Organization', name: BUSINESS.name, url: input.base },
    offers: {
      '@type': 'Offer',
      url: input.url,
      price: (input.priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: input.isPast || input.isFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  };
}

export function articleSchema(input: { title: string; description: string; url: string; publishedAt: string | null; updatedAt: string; base: string }): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title.slice(0, 110),
    description: input.description,
    mainEntityOfPage: input.url,
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    dateModified: input.updatedAt,
    author: { '@type': 'Organization', name: BUSINESS.name, url: input.base },
    publisher: { '@type': 'Organization', name: BUSINESS.name, url: input.base },
  };
}

export function breadcrumbSchema(items: readonly { name: string; url: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
  };
}
