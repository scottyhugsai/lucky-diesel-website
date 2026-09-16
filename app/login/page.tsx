import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HOME_BY_ROLE, getViewer } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in | Lucky Diesel', robots: { index: false } };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  if (viewer) redirect(HOME_BY_ROLE[viewer.profile.role]);

  // Demo shortcuts are opt-in: set DEMO_MODE=true and DEMO_PASSWORD for pitch deployments only.
  const demoPassword = process.env.DEMO_MODE === 'true' ? (process.env.DEMO_PASSWORD ?? null) : null;

  return (
    <main className="grain relative isolate grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image src="/images/build-l5p-purple.jpg" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/40 to-carbon/10" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="kicker">Lucky Diesel</p>
          <p className="display mt-3 text-6xl">Your truck.<span className="block text-clover">Every detail.</span></p>
          <p className="mt-4 max-w-md text-chalk/70">Job status, inspection photos, estimates, tune history and dyno numbers, all in one place.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo-mark.png" alt="" width={48} height={35} className="h-8 w-auto" />
            <span className="display text-2xl not-italic"><span className="text-clover">Lucky</span> Diesel</span>
          </Link>
          <h1 className="display mt-10 text-5xl">Log in</h1>
          <p className="mt-2 text-chalk/65">Customers, techs and the front office all sign in here.</p>
          {params.error === 'link' && (
            <p role="alert" className="mt-5 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm">That sign-in link expired. Request a new one below.</p>
          )}
          <LoginForm next={params.next ?? ''} demoPassword={demoPassword} />
        </div>
      </div>
    </main>
  );
}
