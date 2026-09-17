import type { Metadata } from 'next';
import Link from 'next/link';
import { CartContents } from '@/components/store/CartContents';
import { WRAP } from '@/components/store/styles';
import { BUSINESS } from '@/lib/site';

export const metadata: Metadata = {
  title: `Cart | ${BUSINESS.name}`,
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className={`${WRAP} pb-28 pt-28 sm:pt-36 lg:pb-20`}>
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/store" className="hover:text-clover">Store</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">Cart</span>
      </nav>
      <h1 className="display mt-4 text-5xl sm:text-6xl">Your cart</h1>
      <div className="mt-6 max-w-2xl">
        <CartContents />
      </div>
    </div>
  );
}
