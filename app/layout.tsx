import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

import '@/app/globals.css';
// Leaflet's CSS is required for the location-picker map to lay out correctly.
// Imported globally because Next.js only bundles global stylesheet imports.
import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from '@/components/providers';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/*
 * Type system (Section 3):
 *   - Space Grotesk  → display headings, key numbers (`font-display`)
 *   - Inter          → body copy, forms, lists (`font-sans`, default)
 *   - JetBrains Mono → departure times, route labels, licence plates (`font-mono`)
 * Exposed as CSS variables (`--font-*`) and wired into the Tailwind theme.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

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
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} flex min-h-screen flex-col bg-background font-sans text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
