import type { Metadata } from 'next';
import './globals.css';
import RuntimeConfigInjector from '@/components/RuntimeConfigInjector';

// Force dynamic rendering so runtime env vars are read on each request
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brandog',
  description: 'Brand protection console with a public marketing site and authenticated workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RuntimeConfigInjector />
        {children}
      </body>
    </html>
  );
}
