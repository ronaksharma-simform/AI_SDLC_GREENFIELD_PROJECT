import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CoRide',
  description: 'CoRide ride-sharing platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
