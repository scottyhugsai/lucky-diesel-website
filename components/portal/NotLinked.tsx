import { EmptyState } from '@/components/app/ui';
import { BUSINESS } from '@/lib/site';

/** Shown when a client login isn't attached to a customer record yet. */
export function NotLinked() {
  return (
    <EmptyState title="We can’t find your garage yet">
      Your login isn’t linked to a customer record. Call or text {BUSINESS.phoneDisplay} and we’ll connect it.
    </EmptyState>
  );
}
