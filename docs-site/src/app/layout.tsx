import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FluxHTTP - Modern Zero-Dependency HTTP Client',
  description: 'A modern, lightweight HTTP client for JavaScript/TypeScript with zero dependencies, full TypeScript support, and universal compatibility.',
  keywords: ['http', 'client', 'javascript', 'typescript', 'fetch', 'axios', 'zero-dependencies', 'lightweight'],
  authors: [{ name: 'FluxHTTP Team', url: 'https://fluxhttp.com' }],
  creator: 'FluxHTTP Team',
  publisher: 'FluxHTTP Team',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://fluxhttp.github.io/docs',
    siteName: 'FluxHTTP Documentation',
    title: 'FluxHTTP - Modern Zero-Dependency HTTP Client',
    description: 'A modern, lightweight HTTP client for JavaScript/TypeScript with zero dependencies, full TypeScript support, and universal compatibility.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FluxHTTP Documentation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FluxHTTP - Modern Zero-Dependency HTTP Client',
    description: 'A modern, lightweight HTTP client for JavaScript/TypeScript with zero dependencies, full TypeScript support, and universal compatibility.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}