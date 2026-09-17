/** Bump when the privacy policy's tracking or data-sharing wording changes; visitors are asked for cookie consent again. */
export const PRIVACY_VERSION = '2026-09-17';

export const PRIVACY_VERSION_LOG: readonly { version: string; summary: string }[] = [
  { version: '2026-09-17', summary: 'Added cookies, tracking pixels, server-side conversion sharing, web chat and the cookie choice banner.' },
  { version: '2026-09-16', summary: 'First draft: service requests, portal, payments and text messaging.' },
];
