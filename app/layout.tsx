import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
