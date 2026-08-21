import Link from 'next/link';

import { cn } from '@/lib/utils';

interface RequestSubNavProps {
  active: 'mine' | 'incoming';
}

const TABS = [
  { key: 'mine', href: '/requests', label: 'My requests' },
  { key: 'incoming', href: '/requests/incoming', label: 'Incoming' }
] as const;

/**
 * Tab strip between the Seeker's "My requests" and the Provider's
 * "Incoming requests" views.
 */
export function RequestSubNav({ active }: RequestSubNavProps) {
  return (
    <nav className="flex gap-1 border-b" aria-label="Request views">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
