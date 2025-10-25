import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/nav';

export const metadata: Metadata = {
  title: 'VeronaGrow',
  description: 'Home grow tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <Nav />
        <main className="mx-auto max-w-4xl p-6">{children}</main>
      </body>
    </html>
  );
}