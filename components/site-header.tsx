import Link from 'next/link';
import { CarFront, PlusCircle } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { MobileNav } from '@/components/mobile-nav';

export interface NavItem {
  href: string;
  label: string;
}

/**
 * App-wide header.
 *
 * Reads the session on the server so it can render the correct primary
 * navigation (authenticated actions vs. sign-in/up calls to action) while the
 * individual page routes keep their own authorisation checks.
 */
export async function SiteHeader() {
  const session = await getSession();
  const authed = Boolean(session?.user);

  const primaryItems: NavItem[] = authed
    ? [
        { href: '/rides/feed', label: 'Find a ride' },
        { href: '/requests', label: 'Requests' },
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/rides', label: 'My rides' },
        { href: '/rides/new', label: 'Offer a ride' },
        { href: '/vehicles/new', label: 'Add vehicle' }
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
          aria-label="CoRide home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CarFront className="h-4 w-4" />
          </span>
          <span className="hidden text-lg sm:inline">CoRide</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {authed ? (
            <>
              {primaryItems.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
              <SignOutButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">
                  <PlusCircle />
                  Get started
                </Link>
              </Button>
            </>
          )}
          <ThemeToggle />
        </nav>

        <MobileNav items={primaryItems} authed={authed} />
      </div>
    </header>
  );
}
