import type { Metadata } from 'next';

import '@/app/globals.css';
// Leaflet's CSS is required for the location-picker map to lay out correctly.
// Imported globally because Next.js only bundles global stylesheet imports.
import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from '@/components/providers';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: {
    default: 'CoRide',
    template: '%s | CoRide'
  },
  description: 'CoRide ride-sharing platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
