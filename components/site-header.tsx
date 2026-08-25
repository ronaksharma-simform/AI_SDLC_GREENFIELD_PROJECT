import Link from 'next/link';
import { CarFront, PlusCircle } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { MobileNav } from '@/components/mobile-nav';
import { NotificationBell } from '@/components/notification-bell';

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
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/rides', label: 'Rides' },
        { href: '/vehicles', label: 'Vehicles' },
        { href: '/messages', label: 'Messages' }
      ]
    : [];

  // Compact avatar chip derived from the session (Section 6).
  const displayName = session?.user?.name ?? session?.user?.email ?? '?';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Brand gradient accent bar */}
      <div className="h-0.5 w-full bg-gradient-brand" />
      <div className="w-full border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2 font-semibold tracking-tight"
            aria-label="CoRide home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <CarFront className="h-4 w-4" />
            </span>
            <span className="hidden text-lg sm:inline">
              Co<span className="text-gradient-brand">Ride</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {authed ? (
                <>
                  {primaryItems.map((item) => (
                    <Button key={item.href} asChild variant="ghost" size="sm">
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  ))}
                  <span
                    className="mx-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-white shadow-md shadow-primary/25"
                    title={displayName}
                    aria-label={`Signed in as ${displayName}`}
                  >
                    {avatarInitial}
                  </span>
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

            {/* Bell is rendered outside the desktop nav so it is visible on
                every authenticated page, including mobile (Section 5). */}
            {authed ? <NotificationBell /> : null}

            <MobileNav items={primaryItems} authed={authed} />
          </div>
        </div>
      </div>
    </header>
  );
}
