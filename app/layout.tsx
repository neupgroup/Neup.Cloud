import BaseLayout from '@neup/components/layout/RootLayout';
import { getApplicationBranding } from '@/services/core/application-brand';
import LayoutServer from './layout.server';
import './globals.css';

// Render the document shell and application-wide layout providers.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = getApplicationBranding();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Neup.Cloud | Modern Infrastructure Control</title>
        <meta name="description" content="The future of cloud infrastructure." />
        <link rel="icon" href={branding.favicon} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-white">
        <BaseLayout>
          <LayoutServer>{children}</LayoutServer>
        </BaseLayout>
      </body>
    </html>
  );
}
