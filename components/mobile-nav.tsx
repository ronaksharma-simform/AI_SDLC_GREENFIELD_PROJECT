'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import type { NavItem } from '@/components/site-header';

export function MobileNav({ items, authed }: { items: NavItem[]; authed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X /> : <Menu />}
      </Button>

      {open ? (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-16 z-40 border-b bg-background p-4 shadow-lg"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {authed &&
              items.map((item) => (
                <Button key={item.href} asChild variant="ghost" className="justify-start">
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </Button>
              ))}
            {authed ? (
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <SignOutButton />
                <ThemeToggle />
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <Button asChild variant="ghost" className="flex-1">
                  <Link href="/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                </Button>
                <ThemeToggle />
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
