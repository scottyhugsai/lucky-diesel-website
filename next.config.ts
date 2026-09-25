import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './lib/security-headers';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'luckydiesel.com', pathname: '/cdn/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    return [
      // Everything, including API routes and static files, which the proxy
      // does not match. The CSP is set in the proxy because it needs a nonce.
      { source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] },
      {
        // Preview/demo hosts must never compete with the real domain in search.
        source: '/:path*',
        has: [{ type: 'host', value: '(?<host>.*\\.vercel\\.app)' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/(portal|shop|admin|login)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
